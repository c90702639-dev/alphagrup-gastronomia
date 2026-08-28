module.exports = {
  onPreBuild: ({ utils }) => {
    const { execSync } = require('child_process');
    try {
      execSync('mkdir -p ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts', { stdio: 'inherit' });
      console.log('Added github.com to known_hosts');
    } catch(e) {
      console.log('Warning: could not add github.com host key:', e.message);
    }
  }
};
