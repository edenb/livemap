import { expect } from 'chai';
import {
    addUserAndDevices,
    getUser,
    removeUserAndDevices,
} from './helpers/database.js';
import { adm1, adm1Auth, vwr1 } from './helpers/fixtures.js';
import { queryDbAsync } from '../src/database/db.js';

describe('Database', function () {
    beforeEach(async function () {
        // Add 1 user without devices
        await addUserAndDevices({ ...adm1, ...adm1Auth }, []);
    });

    afterEach(async function () {
        // Remove users and their owned devices
        await removeUserAndDevices(adm1);
        await removeUserAndDevices(vwr1);
    });

    describe('#getNumberOfTables', function () {
        it('should respond with 5 as the number of tables', async function () {
            const { rows, rowCount } = await queryDbAsync(
                'getNumberOfTables',
                [],
            );
            expect(rowCount).to.equal(1);
            expect(rows[0].count).to.equal('5');
        });
    });

    describe('#getUserByUsername', function () {
        it('should respond with no errors', async function () {
            const { rows, rowCount } = await queryDbAsync('getUserByUsername', [
                adm1.username,
            ]);
            expect(rowCount).to.equal(1);
            expect(rows).to.containSubset([adm1]);
        });
    });

    describe('#deleteUser', function () {
        it('should respond with no errors', async function () {
            const user = await getUser(adm1);
            const { rows, rowCount } = await queryDbAsync('deleteUser', [
                user.user_id,
            ]);
            expect(rowCount).to.equal(1);
            expect(rows).to.be.empty;
        });
    });

    describe('#insertUser', function () {
        it('should create 1 user', async function () {
            const { rowCount } = await queryDbAsync('insertUser', [
                vwr1.username,
                vwr1.fullName,
                vwr1.email,
                vwr1.role,
                vwr1.api_key,
                vwr1.password,
            ]);
            expect(rowCount).to.equal(1);
        });
    });
});
