import { expect } from 'chai';
import { vwr1 } from './helpers/fixtures.js';
import { queryDbAsync } from '../src/database/db.js';

let testUser_Id = null;

describe('Database', function () {
    describe('#getNumberOfTables', function () {
        it('should respond with 5 as the number of tables', async function () {
            const queryRes = await queryDbAsync('getNumberOfTables', []);
            expect(queryRes.rowCount).to.equal(1);
            expect(queryRes.rows[0].count).to.equal('5');
        });
    });

    describe('#getUserByUsername', function () {
        it('should respond with no errors', async function () {
            const queryRes = await queryDbAsync('getUserByUsername', [
                vwr1.username,
            ]);
            if (queryRes.rowCount > 0) {
                testUser_Id = queryRes.rows[0].user_id;
            } else {
                testUser_Id = null;
            }
        });
    });

    describe('#deleteUser', function () {
        it('should respond with no errors', async function () {
            const queryRes = await queryDbAsync('deleteUser', [testUser_Id]);
            if (testUser_Id === null) {
                expect(queryRes.rowCount).to.equal(0);
            } else {
                expect(queryRes.rowCount).to.equal(1);
            }
        });
    });

    describe('#insertUser', function () {
        it('should create 1 user', async function () {
            const queryRes = await queryDbAsync('insertUser', [
                vwr1.username,
                vwr1.fullName,
                vwr1.email,
                vwr1.role,
                vwr1.api_key,
                vwr1.password,
            ]);
            expect(queryRes.rowCount).to.equal(1);
        });
    });

    describe('#getUserByUsername', function () {
        it('should return 1 user', async function () {
            const queryRes = await queryDbAsync('getUserByUsername', [
                vwr1.username,
            ]);
            if (queryRes.rowCount > 0) {
                testUser_Id = queryRes.rows[0].user_id;
            } else {
                testUser_Id = null;
            }
            expect(queryRes.rowCount).to.equal(1);
        });
    });

    describe('#deleteUser', function () {
        it('should delete 1 user', async function () {
            const queryRes = await queryDbAsync('deleteUser', [testUser_Id]);
            expect(queryRes.rowCount).to.equal(1);
        });
    });
});
