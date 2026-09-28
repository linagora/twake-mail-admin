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
                    sh 'echo "$DOCKER_HUB_CREDENTIAL_PSW" | docker login -u "$DOCKER_HUB_CREDENTIAL_USR" --password-stdin'
                    sh 'docker push $DOCKER_IMAGE:$DOCKER_TAG'

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
