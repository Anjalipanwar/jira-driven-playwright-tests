import { test } from '@playwright/test';

/**
 * Prints items as a numbered list ("1. <item>") to the console and attaches the same list
 * to the test report (CLAUDE.md: print with console.log AND test.info().attach).
 * Never pass credentials or tokens. Returns the list text.
 */
export async function printNumberedList(title: string, items: string[], attachmentName: string): Promise<string> {
  const list = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  console.log(`${title}:\n${list}`);
  await test.info().attach(attachmentName, { body: list, contentType: 'text/plain' });
  return list;
}
