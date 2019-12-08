import * as fs from 'fs';
import serialize from 'serialize-javascript';

export function saveConfig(
  config: any,
  dirName = '/null', // TODO: make this required
  { guards, actions }: { guards?: any; actions?: any }
) {
  const filename = `${dirName}/protocol.config.js`;
  console.log(`Saving ${filename}`);

  fs.writeFile(
    filename,
    `
const config = ${serialize(config)}
const guards = ${serialize(guards || {})}
const customActions = ${serialize(actions || {})}
const machine = Machine(config, {guards, actions: customActions})
    `,
    console.error
  );
}