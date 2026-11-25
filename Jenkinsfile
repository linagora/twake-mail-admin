// Threat model. Jenkins loads the Jenkinsfile from the trusted revision - the
// target branch - so a pull request can never change the pipeline definition.
// But every stage from Install on runs the contributor's code: npm lifecycle
// scripts, the lint/test/build configs, e2e/pre-build.sh, the Maven plugins,
// docker builds of the pull request's Dockerfiles. That code shares this agent,
// its tool directories and its docker daemon with whatever runs after it,
// including the credentials of a later build.
//
// Hence the rule: a fork pull request runs nothing of its own before a linagora
// member vouched for its head commit (stage Authorize fork, see authorizeFork),
// and credentials are bound only around the steps that use them.
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
    // CHANGE_FORK is 'owner', or 'owner/repository' for a fork renamed on GitHub
    def forkOwner = env.CHANGE_FORK.tokenize('/')[0]
    // The GitHub plugin may set CHANGE_FORK for pull requests from this
    // repository itself, and an organisation is not a member of itself. Such a
    // branch can already be pushed only by someone with write access: trusted.
    if (forkOwner == 'linagora') {
        return true
    }
    def trusted = false
    withGithubCredential {
        trusted = isOrgMember(forkOwner)
    }
    return trusted
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
        if (reportScript == null) {
            return
        }
        if (mayRunChangeCode()) {
            withCredentials([usernamePassword(credentialsId: 'github',
                    usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_TOKEN')]) {
                sh "bash '${reportScript}' || true"
            }
        } else {
            // The fork was not authorized: nothing of it ran, and the failure is
            // the authorization itself, already in the console.
            echo 'Unauthorized fork: the failure report is not posted to GitHub.'
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

    // No pipeline-level credentials, see withGithubCredential and withDockerHubLogin.
    stages {
        // First stages on purpose: nothing from the change request has been run
        // yet at this point.
        stage('Authorize fork') {
            // A fork pull request runs no code of its own before an org member vouches for its head
            // commit, see authorizeFork
            when {
                changeRequest()
                expression { env.CHANGE_FORK != null }
            }
            steps {
                script {
                    authorizeFork()
                }
            }
        }
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
            // A fork pull request reaches this stage only once authorized, see authorizeFork.
            when {
                anyOf {
                    branch 'main'
                    buildingTag()
                    changeRequest()
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

                    withDockerHubLogin {
                        sh 'docker push $DOCKER_IMAGE:$DOCKER_TAG'
                    }

                    if (env.CHANGE_ID) {
                        // A failed comment only warns: the image is already
                        // published, the build should not go red over it.
                        withGithubCredential {
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

def githubRepository() {
  return 'linagora/twake-mail-admin'
}

// ---- Fork authorization and credentials. The same block is in the Jenkinsfiles of
// twake-contacts-frontend, twake-calendar-frontend, twake-calendar-side-service, webadmin-proxy,
// tmail-flutter, esn-sabre, tmail-backend and twake-mail-admin: change it in all of them. Only
// githubRepository() differs.
//
// No credential is bound at pipeline level: every stage runs code of the checked out sources (build
// plugins, package scripts, tests, scripts/), so secrets are bound only around the steps that need
// them, see withGithubCredential and withDockerHubLogin.

// A fork pull request runs no code of its own before an org member vouches for its head commit: the
// owner of the fork is a linagora member, or a member approved that very commit (see
// memberReviewerOf). An approval names one commit, so a commit pushed after it is not built until a
// member approves it again.
def authorizeFork() {
  withGithubCredential {
    // CHANGE_FORK is 'owner', or 'owner/repository' for a fork renamed on GitHub
    def forkOwner = env.CHANGE_FORK.tokenize('/')[0]
    // Jenkins may set CHANGE_FORK to 'linagora' for a branch of the repository itself: only someone
    // with write access pushes there, and an organization is not a member of itself.
    if (forkOwner == 'linagora' || isOrgMember(forkOwner)) {
      echo "Fork owner '${forkOwner}' is a linagora org member, proceeding."
      env.FORK_AUTHORIZED = 'true'
      return
    }
    def headSha = pullRequestHead()
    def approver = memberReviewerOf(headSha)
    if (approver) {
      echo "Commit ${headSha} approved by linagora member '${approver}', proceeding."
      requireApprovedCheckout(headSha)
      env.FORK_AUTHORIZED = 'true'
      return
    }
    error("Fork owner '${forkOwner}' is not a linagora org member and no member reviewed commit ${headSha}. " +
      "A linagora member must approve the pull request on this commit, or comment 'Build this please ${headSha}', " +
      "then re-run the build.")
  }
}

// Whether the build may run code of the checked out sources, for the post actions that run even
// when the fork authorization failed
def mayRunChangeCode() {
  return env.CHANGE_FORK == null || env.FORK_AUTHORIZED == 'true'
}

// The head commit of the pull request, as GitHub reports it now. It need not be the commit Jenkins
// checked out: the contributor can push between the checkout and this call. See
// requireApprovedCheckout.
def pullRequestHead() {
  return githubApi("pulls/${env.CHANGE_ID}").head.sha
}

// Fails the build unless the checked out tree is the approved commit, or its merge with the target
// branch as fetched from this repository. A merge build checks out a merge commit Jenkins made locally:
// its first parent is the pull request revision, its second the target. The contributor writes the
// commits they push, parents and tree included, so the merge is redone and its tree compared: no ref
// of the workspace tells which revision Jenkins pinned. Whatever it reports the status on, that
// revision holds the tree that was tested.
def requireApprovedCheckout(String sha) {
  withEnv(["APPROVED_SHA=${sha}"]) {
    sh '''
      head=$(git rev-parse HEAD)
      if [ "$head" = "$APPROVED_SHA" ]; then
        exit 0
      fi
      refuse() {
        echo "The checkout of $head is not the approved commit $APPROVED_SHA, nor its merge with $CHANGE_TARGET: $1. Re-run the build." >&2
        exit 1
      }
      target=$(git rev-parse -q --verify "refs/remotes/origin/$CHANGE_TARGET^{commit}") || refuse "origin/$CHANGE_TARGET was not fetched"
      [ "$(git rev-parse -q --verify 'HEAD^1' || true)" = "$APPROVED_SHA" ] || refuse "its first parent is not the approved commit"
      [ "$(git rev-parse -q --verify 'HEAD^2' || true)" = "$target" ] || refuse "its second parent is not origin/$CHANGE_TARGET"
      [ -z "$(git rev-parse -q --verify 'HEAD^3' || true)" ] || refuse "it has more than two parents"
      # The contributor may have written this merge commit with a tree of their own: redo the merge
      # in a scratch worktree, outside the workspace, and compare the trees.
      scratch="$WORKSPACE@tmp/approved-merge"
      rm -rf "$scratch"
      git worktree add -q --detach "$scratch" "$APPROVED_SHA"
      git -C "$scratch" -c user.name=Jenkins -c user.email=jenkins@localhost merge -q --no-edit "$target" >/dev/null 2>&1 || true
      expected=$(git -C "$scratch" rev-parse 'HEAD^{tree}')
      clean=$(git -C "$scratch" status --porcelain)
      git worktree remove --force "$scratch"
      [ -z "$clean" ] && [ "$expected" = "$(git rev-parse 'HEAD^{tree}')" ] || refuse "its tree is not the merge of the approved commit with origin/$CHANGE_TARGET"
      echo "Building $head, the merge of the approved commit $APPROVED_SHA with origin/$CHANGE_TARGET"
    '''
  }
}

// The login of a linagora member who vouched for the given commit: an approving review of it, a review
// 'Build this please' of it, or a comment 'Build this please <sha>' naming its full id. A prefix is not
// accepted: the contributor writes the commits, and can craft one sharing a short prefix with the
// reviewed one. GitHub lists reviews and comments oldest first, 100 per page at most: every page is read.
def memberReviewerOf(String sha) {
  def page = 1
  while (true) {
    def reviews = githubApi("pulls/${env.CHANGE_ID}/reviews?per_page=100&page=${page}")
    for (review in reviews) {
      def approves = review.state == 'APPROVED' ||
        (review.state != 'DISMISSED' && "${review.body}".trim() == 'Build this please')
      if (review.commit_id == sha && approves && isOrgMember(review.user.login)) {
        return review.user.login
      }
    }
    if (reviews.size() < 100) {
      break
    }
    page++
  }
  def approval = "build this please ${sha}".toString()
  page = 1
  while (true) {
    def comments = githubApi("issues/${env.CHANGE_ID}/comments?per_page=100&page=${page}")
    for (comment in comments) {
      def body = "${comment.body}".trim().toLowerCase().replaceAll('\\s+', ' ')
      if (body == approval && isOrgMember(comment.user.login)) {
        return comment.user.login
      }
    }
    if (comments.size() < 100) {
      return null
    }
    page++
  }
}

def isOrgMember(String login) {
  def status
  withEnv(["GITHUB_LOGIN=${login}"]) {
    status = sh(
      script: 'curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_CREDENTIAL_PSW" ' +
        '"https://api.github.com/orgs/linagora/members/$GITHUB_LOGIN"',
      returnStdout: true
    ).trim()
  }
  echo "GitHub org membership check returned HTTP ${status} for '${login}'"
  if (status == '204') {
    return true
  }
  if (status == '404') {
    return false
  }
  error("GitHub API error ${status} while checking the membership of '${login}'")
}

def githubApi(String path) {
  def json
  withEnv(["GITHUB_API_PATH=${path}", "GITHUB_API_REPOSITORY=${githubRepository()}"]) {
    json = sh(
      script: 'curl -sf -H "Authorization: token $GITHUB_CREDENTIAL_PSW" ' +
        '"https://api.github.com/repos/$GITHUB_API_REPOSITORY/$GITHUB_API_PATH"',
      returnStdout: true
    )
  }
  return readJSON(text: json)
}

// Binds the GitHub token as GITHUB_CREDENTIAL_USR / GITHUB_CREDENTIAL_PSW around the given steps only
def withGithubCredential(Closure body) {
  withCredentials([usernamePassword(credentialsId: 'github',
      usernameVariable: 'GITHUB_CREDENTIAL_USR', passwordVariable: 'GITHUB_CREDENTIAL_PSW')]) {
    body()
  }
}

// Logs in Docker Hub in a throwaway Docker config deleted afterwards, so that the credential never
// stays on the agent where a later build could read it
def withDockerHubLogin(Closure body) {
  withEnv(["DOCKER_CONFIG=${pwd(tmp: true)}/docker-config"]) {
    try {
      withCredentials([usernamePassword(credentialsId: 'dockerHub',
          usernameVariable: 'DOCKER_HUB_CREDENTIAL_USR', passwordVariable: 'DOCKER_HUB_CREDENTIAL_PSW')]) {
        sh 'mkdir -p "$DOCKER_CONFIG" && printf \'%s\' "$DOCKER_HUB_CREDENTIAL_PSW" | docker login -u "$DOCKER_HUB_CREDENTIAL_USR" --password-stdin'
      }
      body()
    } finally {
      sh 'docker logout || true; rm -rf "$DOCKER_CONFIG"'
    }
  }
}
