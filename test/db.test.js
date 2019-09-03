"use strict";
require('chai').should();
const db = require('../src/db.js');

const testUser = {
    username: 'testuser1',
    fullName: 'Test User1',
    email: 'test@user1',
    role: 'user',
    api_key: '12345678'
};

let testUser_Id = null;

describe('Database', () => {
    describe('#getNumberOfTables', () => {
      it('should respond with 1 row', (done) => {
        db.queryDb('getNumberOfTables', [], (err, rows, result) => {
          if (err) return done(err);
          result.rowCount.should.equal(1);
          done();
        });
      });
      it('should respond with 5 as the number of tables', (done) => {
        db.queryDb('getNumberOfTables', [], (err, rows, result) => {
          if (err) return done(err);
           result.rows[0].count.should.equal('5');
          done();
        });
      });
    });

    describe('#findUserByUsername', () => {
        it('should respond with no errors', (done) => {
          db.queryDb('findUserByUsername', [testUser.username], (err, rows, result) => {
            if (err) return done(err);
            if (result.rowCount > 0) {
                testUser_Id = rows[0].user_id;
            } else {
                testUser_Id = null;
            }
            done();
          });
        });   
    });

    describe('#deleteUser', () => {
        it('should respond with no errors', (done) => {
          db.queryDb('deleteUser', [testUser_Id], (err) => {
            if (err) return done(err);
            done();
          });
        });   
    });

    describe('#insertUser', () => {
        it('should create 1 user', (done) => {
          db.queryDb('insertUser', [testUser.username, testUser.fullName, testUser.email, testUser.role, testUser.api_key], (err, rows, result) => {
            if (err) return done(err);
            result.rowCount.should.equal(1);
            done();
          });
        });   
    });

    describe('#findUserByUsername', () => {
        it('should return 1 user', (done) => {
          db.queryDb('findUserByUsername', [testUser.username], (err, rows, result) => {
            if (err) return done(err);
            if (result.rowCount > 0) {
                testUser_Id = rows[0].user_id;
            } else {
                testUser_Id = null;
            }
            result.rowCount.should.equal(1);
            done();
          });
        });   
    });

    describe('#deleteUser', () => {
        it('should delete 1 user', (done) => {
          db.queryDb('deleteUser', [testUser_Id], (err, rows, result) => {
            if (err) return done(err);
            result.rowCount.should.equal(1);
            done();
          });
        });   
    });
});
