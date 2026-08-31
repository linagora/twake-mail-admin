pipeline {
    agent any

    environment {
        DOCKER_HUB_CREDENTIAL = credentials('dockerHub')
    }

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
                }
            }
            steps {
                script {
                    env.DOCKER_TAG = 'branch-master'
                    if (env.TAG_NAME) {
                        env.DOCKER_TAG = env.TAG_NAME
                    }

                    echo "Docker tag: ${env.DOCKER_TAG}"
                    env.GIT_REVISION = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()

                    sh 'docker build -t linagora/twake-mail-admin:$DOCKER_TAG .'
                    sh 'docker login -u $DOCKER_HUB_CREDENTIAL_USR -p $DOCKER_HUB_CREDENTIAL_PSW'
                    sh 'docker push linagora/twake-mail-admin:$DOCKER_TAG'

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
