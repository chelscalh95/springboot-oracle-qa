import { test as base, expect } from '@playwright/test';
import { IndividualsApi } from './api/individualsApi';
import { TestData } from './data/testData';
import { OracleSession } from './db/oracle';
import { PersonDb } from './db/personDb';

interface Fixtures {
  /** The application's REST API. */
  api: IndividualsApi;
  /** Direct access to the application's Oracle schema (setup, verification, cleanup). */
  db: PersonDb;
  /** Unique marker + payload builders. Everything carrying the marker is deleted after the test, pass or fail. */
  data: TestData;
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new IndividualsApi(request));
  },

  db: async ({}, use) => {
    const session = await OracleSession.open();
    try {
      await use(new PersonDb(session));
    } finally {
      await session.close();
    }
  },

  data: async ({ db }, use) => {
    const data = new TestData();
    try {
      await use(data);
    } finally {
      await db.deleteByMarker(data.marker); // runs even when the test failed
    }
  },
});

export { expect };
