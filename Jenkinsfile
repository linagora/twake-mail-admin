import groovy.transform.Field

// Threat model. Jenkins loads the Jenkinsfile from the trusted revision - the
// target branch - so a pull request can never change the pipeline definition.
// But every stage from Install on runs the contributor's code: npm lifecycle
// scripts, the lint/test/build configs, e2e/pre-build.sh, the Maven plugins,
// docker builds of the pull request's Dockerfiles. That code shares this agent,
// its tool directories and its docker daemon with whatever runs after it.
//
// Hence the one rule that matters: once code from an untrusted change request
// has run, this build never binds a credential again. The trust of the change
// request is decided by the first stage, before anything from it has run, and
// every later credential binding checks credentialsAllowed().
//
// Files that the pipeline itself executes, or that decide what it executes.
// Refusing changes to them keeps the failure report script and the profile
// editor reviewed, but it is NOT the security boundary: package.json, the lock
// file, *.config.*, e2e/ and the Dockerfiles execute too.
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
    // The GitHub plugin sets CHANGE_FORK even for pull requests from this
    // repository itself, and an organisation is not a member of itself, so a
    // same-repo branch would fail the membership check below. Such a branch
    // can already be pushed only by someone with write access: trusted.
    if (forkOwner == 'linagora') {
        return true
    }
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

// The commit of the change request this build runs, as GitHub records it -
// asked before anything from the change request has run. Null when it cannot be
// established: the checked out HEAD must be that commit, or a merge of it.
def changeHeadSha() {
    def pullJson = null
    withCredentials([usernamePassword(credentialsId: 'github',
            usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_CREDENTIAL_PSW')]) {
        pullJson = sh(
            script: """curl -s \
              -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
              "https://api.github.com/repos/linagora/twake-mail-admin/pulls/\${CHANGE_ID}" """,
            returnStdout: true
        ).trim()
    }
    def pull = readJSON text: pullJson
    String head = pull?.head?.sha
    if (head == null || !head.matches('[0-9a-f]{40}')) {
        error("Unexpected GitHub API answer while reading the head of #${env.CHANGE_ID}")
    }
    // HEAD itself with the head strategy, one of its parents when Jenkins
    // builds the merge with the target branch.
    def built = sh(script: 'git rev-list --parents -n 1 HEAD', returnStdout: true).trim().split(' ') as List
    if (!built.contains(head)) {
        echo "The pull request head ${head} is not the commit being built (${built[0]}): it moved meanwhile."
        return null
    }
    return head
}

// A change request from outside the organisation is vouched for once a linagora
// member comments "Build this please <sha>" on it, <sha> being the full 40
// character id of the commit they reviewed. A prefix is not accepted: the
// contributor writes the commits, and can craft a second one sharing a short
// prefix with the reviewed one. The approval covers that commit only: a later
// push by the contributor needs a new one. A bare "Build this please"
// approves nothing, as it would carry over to unreviewed pushes.
def approvedByMember() {
    String head = changeHeadSha()
    if (head == null) {
        return false
    }
    def approved = false
    withCredentials([usernamePassword(credentialsId: 'github',
            usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_CREDENTIAL_PSW')]) {
        def commentsJson = sh(
            script: """curl -s \
              -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
              "https://api.github.com/repos/linagora/twake-mail-admin/issues/\${CHANGE_ID}/comments?per_page=100" """,
            returnStdout: true
        ).trim()
        def comments = readJSON text: commentsJson
        if (!(comments instanceof List)) {
            error("Unexpected GitHub API answer while listing the comments of #${env.CHANGE_ID}")
        }
        for (comment in comments) {
            String body = comment.body?.trim()?.toLowerCase()?.replaceAll('\\s+', ' ')
            if (body == null || !body.matches('build this please [0-9a-f]{40}')) {
                continue
            }
            String approvedSha = body.substring('build this please '.length())
            if (head != approvedSha) {
                continue
            }
            def commenter = comment.user.login
            def commenterStatus = sh(
                script: """curl -s -o /dev/null -w "%{http_code}" \
                  -H "Authorization: token \${GITHUB_CREDENTIAL_PSW}" \
                  "https://api.github.com/orgs/linagora/members/${commenter}" """,
                returnStdout: true
            ).trim()
            if (commenterStatus == '204') {
                echo "Build of ${head} approved by linagora member '${commenter}'."
                approved = true
                break
            }
        }
    }
    if (!approved) {
        echo "Not approved: a linagora member can approve this commit by commenting \"Build this please ${head}\"."
    }
    return approved
}

// 'member'    - a branch or tag build, or a change request someone with push
//               access could have pushed anyway;
// 'approved'  - a fork from outside the organisation whose built commit a
//               member vouched for;
// 'untrusted' - anything else.
// Null until the first stage decided it: an unknown trust is no trust.
@Field String changeTrust = null

// Must only run before anything from the change request has: it binds the
// GitHub token, and calls curl through a PATH the change request could
// otherwise have tampered with.
def assessChangeTrust() {
    if (!env.CHANGE_ID || isTrustedContributor()) {
        changeTrust = 'member'
    } else if (approvedByMember()) {
        changeTrust = 'approved'
    } else {
        changeTrust = 'untrusted'
    }
    echo "Change request trust: ${changeTrust}"
}

// Whether this build may still bind a credential. Never assesses anything
// itself: by the time it is asked, the change request's code has run.
def credentialsAllowed() {
    if (!env.CHANGE_ID) {
        return true
    }
    return changeTrust == 'member' || changeTrust == 'approved'
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
    if (!env.CHANGE_ID || changeTrust == 'member') {
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
        if (reportScript == null) {
            return
        }
        if (credentialsAllowed()) {
            withCredentials([usernamePassword(credentialsId: 'github',
                    usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_TOKEN')]) {
                sh "bash '${reportScript}' || true"
            }
        } else {
            // The change request's code has run on this agent: the curl, awk,
            // find... the script starts could be its own. The report is only
            // written to the console; a member can rerun with "Build this please <sha>".
            echo 'Untrusted change request: the failure report is not posted to GitHub.'
            sh "bash '${reportScript}' || true"
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
        // yet at this point, so this is the only place its trust can be
        // assessed with a credential.
        stage('Validate CI files') {
            when {
                changeRequest()
            }
            steps {
                script {
                    fetchChangeTarget()
                    assessChangeTrust()
                    def offending = changedCiFiles()
                    if (offending.isEmpty()) {
                        echo 'No CI file touched by this change request.'
                    } else if (changeTrust == 'member') {
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
                    sh 'npm audit --omit=dev --audit-level=high'
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
                tee('ci-logs/End to end tests.log') {
                    dir('e2e') {
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
                tee('ci-logs/Profile editor.log') {
                    dir('profile-editor') {
                        sh 'PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -t . -v'
                    }
                }
            }
        }
        stage('Deploy docker image') {
            // Gated before any credential is bound: no stage level environment,
            // which Jenkins would evaluate before the when condition.
            when {
                anyOf {
                    branch 'main'
                    buildingTag()
                    allOf {
                        changeRequest()
                        // A fork owned by someone outside the linagora
                        // organization only gets an image once a linagora
                        // member commented "Build this please <sha>" on it - checked
                        // by the first stage, before the fork's code ran.
                        expression { credentialsAllowed() }
                    }
                }
            }
            steps {
                script {
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

                    // The Docker Hub login lands in a configuration private to
                    // this build, removed right after the push: in the agent's
                    // ~/.docker it would outlive the build, readable by the next
                    // pull request's code on this shared agent.
                    def tmpDir = env.WORKSPACE_TMP ?: "${env.WORKSPACE}@tmp"
                    def dockerConfig = sh(
                        returnStdout: true,
                        script: "mkdir -p '${tmpDir}' && mktemp -d '${tmpDir}/docker-config-XXXXXXXX'"
                    ).trim()
                    try {
                        withEnv(["DOCKER_CONFIG=${dockerConfig}"]) {
                            withCredentials([usernamePassword(credentialsId: 'dockerHub',
                                    usernameVariable: 'DOCKER_HUB_CREDENTIAL_USR', passwordVariable: 'DOCKER_HUB_CREDENTIAL_PSW')]) {
                                sh 'echo "$DOCKER_HUB_CREDENTIAL_PSW" | docker login -u "$DOCKER_HUB_CREDENTIAL_USR" --password-stdin'
                            }
                            sh 'docker push $DOCKER_IMAGE:$DOCKER_TAG'
                        }
                    } finally {
                        sh "rm -rf '${dockerConfig}'"
                    }

                    if (env.CHANGE_ID) {
                        // A failed comment only warns: the image is already
                        // published, the build should not go red over it.
                        withCredentials([usernamePassword(credentialsId: 'github',
                                usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_CREDENTIAL_PSW')]) {
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
