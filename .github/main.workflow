workflow "Build" {
  on = "push"
  resolves = ["Test"]
}

action "Install" {
  uses = "Borales/actions-yarn@master"
  args = "install"
}

action "Lint" {
  needs = "Install"
  uses = "Borales/actions-yarn@master"
  args = "lint"
}

action "Test" {
  needs = "Lint"
  uses = "Borales/actions-yarn@master"
  args = "test"
}

workflow "Update" {
  on = "schedule(0 0 * * 3)"
  resolves = ["package-update"]
}

action "package-update" {
  uses = "taichi/actions-package-update@master"
  args = "-u --packageFile package.json --loglevel verbose "
  env  = {
    AUTHOR_NAME = "taichi"
    AUTHOR_EMAIL = "ryushi@gmail.com"
    LOG_LEVEL = "debug"
    EXECUTE = "true"
  }
  secrets = ["GITHUB_TOKEN"]
}
