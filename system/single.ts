import { exec } from 'child_process';

try {
  const name = process.argv[2];

  if (!name) {
    throw 'Feature not found';
  }

  /*
  exec(`npx cucumber-js ./features/${name}/${name}.feature && npm run report`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
  */
  // Use spawn to stream output
  const { spawn } = require('child_process');
  const child = spawn('npx', ['cucumber-js', `./features/${name}/${name}.feature`], { stdio: 'inherit', shell: true });
  
  child.on('close', (code: number) => {
    if (code === 0) {
      // Run report if successful
      const report = spawn('npm', ['run', 'report'], { stdio: 'inherit', shell: true });
    } else {
      process.exit(code);
    }
  });
} catch (e: any) {
  console.error(`Error: ${e}`);
}