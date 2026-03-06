import { MainAPI } from '@model/main-api';
import { FilterData } from '../components/FilterContent';
import { BurritoWrapper } from 'burrito/data/wrapperBuilder';

const ipc = window?.api as MainAPI;

export async function convertWrapperToPTFs(
  filter: FilterData,
  dirPath: string
) {
  console.log(filter, dirPath);
  // Load up metadata
  // For each burrito in contents:
  //  Get the path
  //  Read metadata for that burrito
  //
  const data = await ipc.read(dirPath, { encoding: 'utf-8' });
  const json: BurritoWrapper = JSON.parse(data as string);
  console.log(json);
}

export function convertBookToPTF() {
  // make a new directory for ptf named after the project
  // Create SILTranscriber and Version
  console.log();
}
