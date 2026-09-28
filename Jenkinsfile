pipeline {
    agent any

    tools {
        nodejs 'nodejs_24'
    }

    options {
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        stage('Audit') {
            steps {
                sh 'npm audit --audit-level=high'
            }
        }
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
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
                    sh 'PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -t . -v'
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
        always {
            deleteDir()
        }
    }
}
