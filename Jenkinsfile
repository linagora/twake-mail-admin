// Files that the pipeline itself executes, or that decide what it executes.
// Jenkins loads the Jenkinsfile from the trusted revision - the target branch -
// so a pull request can never change the pipeline definition. Everything else
// below is read from the workspace, which holds the contributor's code, so a
// pull request changing them would be running its own code inside our CI.
def protectedCiPaths() {
    return ['Jenkinsfile', 'ci/', 'profile-editor/']
}

// A contributor is trusted when they can already push to the repository: either
// the change request comes from a branch of linagora/twake-mail-admin, or from a
// fork owned by a member of the linagora organisation.
def isTrustedContributor() {
    if (!env.CHANGE_FORK) {
        return true
    }

    def forkOwner = env.CHANGE_FORK.split('/')[0]
    def status = null
    withCredentials([usernamePassword(credentialsId: 'github',
            usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_CREDENTIAL_PSW')]) {
        status = sh(
            script: """curl -s -o /dev/null -w "%{http_code}" \
              -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
              "https://api.github.com/orgs/linagora/members/${forkOwner}" """,
            returnStdout: true
        ).trim()
    }

    echo "GitHub org membership check returned HTTP ${status} for '${forkOwner}'"
    if (status == '204') {
        return true
    }
    if (status == '404') {
        return false
    }
    if (status == '401' || status == '403') {
        error("Authentication/permission error validating fork owner: ${status}")
    }
    error("GitHub API error ${status} while checking membership for '${forkOwner}'")
}

// Makes the target branch reachable as origin/<target> so that the change
// request can be diffed against it, whatever pull request discovery strategy
// the job is configured with.
def fetchChangeTarget() {
    if (!env.CHANGE_TARGET) {
        error('CHANGE_TARGET is not set: cannot determine what this change request modifies.')
    }
    sh "git fetch --no-tags --quiet origin '+refs/heads/${env.CHANGE_TARGET}:refs/remotes/origin/${env.CHANGE_TARGET}'"
}

def changedCiFiles() {
    def changed = sh(
        script: "git diff --name-only 'origin/${env.CHANGE_TARGET}...HEAD'",
        returnStdout: true
    )

    def offending = []
    for (String path : changed.split('\n')) {
        String candidate = path.trim()
        if (candidate.isEmpty()) {
            continue
        }
        for (String protectedPath : protectedCiPaths()) {
            if (candidate == protectedPath || candidate.startsWith(protectedPath)) {
                offending.add(candidate)
                break
            }
        }
    }
    return offending
}

// The report script is handed the GitHub token, so it has to be a reviewed
// version of it. On a branch or tag build, and for a contributor allowed to
// change CI files, the workspace copy is that version. For anybody else the
// workspace copy is unreviewed code, so the target branch one is extracted
// instead - the guard stage already refuses such a change request, this is the
// second lock. Returns null when no trusted copy can be found, and the failure
// is then simply not reported rather than reported by untrusted code.
def trustedReportScript() {
    if (!env.CHANGE_ID || isTrustedContributor()) {
        return 'ci/report-build-failure.sh'
    }

    fetchChangeTarget()
    // mktemp, in the temporary directory Jenkins owns next to the workspace: a
    // predictable path under a world writable /tmp could be pre-created by
    // anything else running on this shared agent, and what lands there is about
    // to be run with the GitHub token.
    def tmpDir = env.WORKSPACE_TMP ?: "${env.WORKSPACE}@tmp"
    def scriptPath = sh(
        returnStdout: true,
        script: "mkdir -p '${tmpDir}' && mktemp '${tmpDir}/report-build-failure-XXXXXXXX.sh'"
    ).trim()

    def extracted = sh(
        returnStatus: true,
        script: "git show 'origin/${env.CHANGE_TARGET}:ci/report-build-failure.sh' > '${scriptPath}'"
    )
    if (extracted != 0) {
        echo "No report script on ${env.CHANGE_TARGET}: the build failure is not reported."
        sh "rm -f '${scriptPath}'"
        return null
    }
    return scriptPath
}

// Posts the failing tests - or, when none was reported, the tail of the failing
// stage output - back to the pull request, so that a coding agent can pick the
// build failure up and drive it back to green on its own.
//
// Only the stages that hold no credential are teed to ci-logs: the tee step
// captures the raw stream, before the console log filter that masks secrets, so
// a teed log of a stage handling credentials would carry them in clear text -
// straight into a public pull request comment.
// Reporting is best effort: a GitHub API hiccup or a missing target branch must
// not hide the failure being reported, nor turn an unstable build into a failed
// one, so nothing here is allowed to escape.
def reportBuildFailure() {
    def reportScript = null
    try {
        archiveArtifacts artifacts: 'ci-logs/*.log', allowEmptyArchive: true, fingerprint: false

        reportScript = trustedReportScript()
        if (reportScript != null) {
            withCredentials([usernamePassword(credentialsId: 'github',
                    usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_TOKEN')]) {
                sh "bash '${reportScript}' || true"
            }
        }
    } catch (Exception e) {
        echo "Could not report the build failure: ${e.message}"
    } finally {
        if (reportScript != null && reportScript != 'ci/report-build-failure.sh') {
            sh "rm -f '${reportScript}'"
        }
    }
}

pipeline {
    agent {
        // The e2e stage boots two backend stacks in docker
        label 'heavy'
    }

    tools {
        nodejs 'nodejs_24'
    }

    options {
        // The e2e suite is budgeted 30 minutes, on top of the stack boot
        timeout(time: 2, unit: 'HOURS')
        disableConcurrentBuilds()
    }

    stages {
        // First stage on purpose: nothing from the change request has been run
        // yet at this point.
        stage('Validate CI files') {
            when {
                changeRequest()
            }
            steps {
                script {
                    fetchChangeTarget()
                    def offending = changedCiFiles()
                    if (offending.isEmpty()) {
                        echo 'No CI file touched by this change request.'
                    } else if (isTrustedContributor()) {
                        echo "Trusted contributor, changes to ${offending.join(', ')} allowed."
                    } else {
                        error("""This change request modifies files the CI executes: ${offending.join(', ')}.
Contributors outside the linagora organisation cannot change them, as the build would then run unreviewed code with access to the CI credentials.
Please drop these changes from the pull request, or ask a linagora member to carry them.""")
                    }
                }
            }
        }
        stage('Install') {
            steps {
                tee('ci-logs/Install.log') {
                    sh 'npm install'
                }
            }
        }
        stage('Audit') {
            steps {
                tee('ci-logs/Audit.log') {
                    sh 'npm audit --audit-level=high'
                }
            }
        }
        stage('Lint') {
            steps {
                tee('ci-logs/Lint.log') {
                    sh 'npm run lint'
                }
            }
        }
        stage('Test') {
            steps {
                tee('ci-logs/Test.log') {
                    sh 'npm test'
                }
            }
        }
        stage('Build') {
            steps {
                tee('ci-logs/Build.log') {
                    sh 'npm run build'
                }
            }
        }
        stage('End to end tests') {
            // Drives the production image of the admin app, built from this checkout,
            // against real backends: Mail over a distributed tmail-backend, Calendar over
            // the twake-calendar side service. See e2e/README.md.
            steps {
                dir('e2e') {
                    tee('ci-logs/End to end tests.log') {
                        sh './pre-build.sh'
                        sh 'mvn clean test'
                    }
                }
            }
            post {
                always {
                    junit(testResults: 'e2e/target/surefire-reports/*.xml', allowEmptyResults: false)
                }
                failure {
                    // Screenshots and Playwright traces of whatever broke
                    archiveArtifacts artifacts: 'e2e/target/e2e-artifacts/**', allowEmptyArchive: true
                }
            }
        }
        stage('Profile editor') {
            // Guards the generator against the frontend it describes: its tests
            // re-read validation.md, the proxy resolver and every useIsAllowed
            // call site from this checkout, and fail when they disagree.
            //
            // Standard library only — no venv, no pip, nothing to install. The
            // agent needs python3 >= 3.10 and nothing else.
            steps {
                dir('profile-editor') {
                    tee('ci-logs/Profile editor.log') {
                        sh 'PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -t . -v'
                    }
                }
            }
        }
        stage('Deploy docker image') {
            when {
                anyOf {
                    branch 'main'
                    buildingTag()
                    changeRequest()
                }
            }
            environment {
                DOCKER_HUB_CREDENTIAL = credentials('dockerHub')
                GITHUB_CREDENTIAL = credentials('github')
            }
            steps {
                script {
                    // A fork owned by someone outside the linagora organization
                    // only gets an image once a linagora member has commented
                    // "Build this please" on the pull request.
                    if (env.CHANGE_FORK) {
                        def forkOwner = env.CHANGE_FORK.split('/')[0]
                        def memberStatus = sh(
                            script: """curl -s -o /dev/null -w "%{http_code}" \
                              -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
                              "https://api.github.com/orgs/linagora/members/${forkOwner}" """,
                            returnStdout: true
                        ).trim()
                        echo "GitHub org membership check returned HTTP ${memberStatus} for '${forkOwner}'"
                        if (memberStatus == '204') {
                            echo "Fork owner '${forkOwner}' is a linagora org member, proceeding."
                        } else if (memberStatus == '404') {
                            echo "Fork owner '${forkOwner}' is not a member of the linagora organization."
                            def approvedByMember = false
                            def commentsJson = sh(
                                script: """curl -s \
                                  -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
                                  "https://api.github.com/repos/linagora/twake-mail-admin/issues/\${CHANGE_ID}/comments?per_page=100" """,
                                returnStdout: true
                            ).trim()
                            def comments = readJSON text: commentsJson
                            for (comment in comments) {
                                if (comment.body.trim().toLowerCase() == 'build this please') {
                                    def commenter = comment.user.login
                                    def commenterStatus = sh(
                                        script: """curl -s -o /dev/null -w "%{http_code}" \
                                          -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
                                          "https://api.github.com/orgs/linagora/members/${commenter}" """,
                                        returnStdout: true
                                    ).trim()
                                    if (commenterStatus == '204') {
                                        echo "Build approved by linagora member '${commenter}', proceeding."
                                        approvedByMember = true
                                        break
                                    }
                                }
                            }
                            if (!approvedByMember) {
                                echo "No linagora member approval found. Skipping PR image delivery."
                                return
                            }
                        } else if (memberStatus == '401' || memberStatus == '403') {
                            error("Authentication/permission error validating fork owner: ${memberStatus}")
                        } else {
                            error("GitHub API error ${memberStatus} while checking membership for '${forkOwner}'")
                        }
                    }

                    env.DOCKER_IMAGE = 'linagora/twake-mail-admin'
                    env.DOCKER_TAG = 'branch-master'
                    if (env.TAG_NAME) {
                        env.DOCKER_TAG = env.TAG_NAME
                    } else if (env.CHANGE_ID) {
                        // Pull requests land in a separate repository so that a
                        // reviewer can run the change (e.g. twake-mail-admin-pr:86)
                        // without polluting the release tags.
                        env.DOCKER_IMAGE = 'linagora/twake-mail-admin-pr'
                        env.DOCKER_TAG = env.CHANGE_ID
                    }

                    echo "Docker image: ${env.DOCKER_IMAGE}:${env.DOCKER_TAG}"
                    env.GIT_REVISION = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()

                    sh 'docker build -t $DOCKER_IMAGE:$DOCKER_TAG .'
                    sh 'echo "$DOCKER_HUB_CREDENTIAL_PSW" | docker login -u "$DOCKER_HUB_CREDENTIAL_USR" --password-stdin'
                    sh 'docker push $DOCKER_IMAGE:$DOCKER_TAG'

                    if (env.CHANGE_ID) {
                        // A failed comment only warns: the image is already
                        // published, the build should not go red over it.
                        sh '''
                            HTTP_STATUS=$(curl -s -o gh_comment_response.json -w "%{http_code}" -X POST \\
                              -H "Authorization: token $GITHUB_CREDENTIAL_PSW" \\
                              -H "Content-Type: application/json" \\
                              -d "{\\"body\\": \\"Docker image published for this PR: $DOCKER_IMAGE:$DOCKER_TAG\\"}" \\
                              "https://api.github.com/repos/linagora/twake-mail-admin/issues/$CHANGE_ID/comments")
                            if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
                              echo "WARNING: GitHub API comment failed with HTTP $HTTP_STATUS"
                              cat gh_comment_response.json
                            fi
                        '''
                    }

                    // The profile editor, pinned alongside the frontend it
                    // describes: its endpoint inventory is baked into the image,
                    // so an operator running the tag gets the questionnaire for
                    // exactly that version — no checkout, no version drift.
                    // sh '''docker build \
                    //        --build-arg VERSION=$DOCKER_TAG \
                    //        --build-arg REVISION=$GIT_REVISION \
                    //        -t linagora/twake-mail-admin-profile-editor:$DOCKER_TAG \
                    //        profile-editor'''
                    //
                    // sh 'docker push linagora/twake-mail-admin-profile-editor:$DOCKER_TAG'
                }
            }
        }
    }
    post {
        failure {
            reportBuildFailure()
        }
        unstable {
            reportBuildFailure()
        }
        cleanup {
            deleteDir() /* clean up our workspace */
        }
    }
}
