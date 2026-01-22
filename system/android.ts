import { exec } from 'child_process';

try {
  const name = process.argv[2];

  if (!name) {
    throw 'Feature not found';
  }

  exec(`npx cucumber-js ./android/${name}/${name}.feature && bun run report`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
} catch (e: any) {
  console.error(`Error: ${e}`);
}