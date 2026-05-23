import { seedDemoData } from './seed';

export async function resetDemo() {
  return seedDemoData();
}
