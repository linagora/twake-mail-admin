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
                    sh 'docker build -t linagora/twake-mail-admin:$DOCKER_TAG .'
                    sh 'docker login -u $DOCKER_HUB_CREDENTIAL_USR -p $DOCKER_HUB_CREDENTIAL_PSW'
                    sh 'docker push linagora/twake-mail-admin:$DOCKER_TAG'
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
