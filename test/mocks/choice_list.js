import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Select an option:');
console.log('1) Production');
console.log('2) Staging');
console.log('3) Development');
process.stdout.write('> ');

rl.question('', (answer) => {
  console.log(`Selected: ${answer}`);
  rl.close();
});
