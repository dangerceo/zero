import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

process.stdout.write('Enter password: ');
rl.question('', (password) => {
  console.log('\nPassword received: ' + '*'.repeat(password.length));
  rl.close();
});
