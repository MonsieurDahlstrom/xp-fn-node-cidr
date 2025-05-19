module.exports = {
  branches: ['main', { name: 'next', prerelease: true }],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    '@semantic-release/github',
    ['@semantic-release/exec', {
      prepareCmd: 'docker build -t ghcr.io/${env.GITHUB_REPOSITORY}:${nextRelease.version} .',
      publishCmd: 'echo ${env.GH_TOKEN} | docker login ghcr.io -u ${env.GITHUB_ACTOR} --password-stdin && docker push ghcr.io/${env.GITHUB_REPOSITORY}:${nextRelease.version}'
    }]
  ]
}
