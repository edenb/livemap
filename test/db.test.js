"use strict";
const should = require('chai').should();
const db = require('../src/db.js');

var testUser = {
    username: 'testuser1',
    fullName: 'Test User1',
    email: 'test@user1',
    role: 'user',
    api_key: '1234'
};

var testUser_Id = null;

describe('Database', function() {
    describe('#getNumberOfTables', function() {
      it('respond with 1 row', function(done) {
        db.queryDb('getNumberOfTables', [], function (err, rows, result) {
          if (err) return done(err);
          result.rowCount.should.equal(1);
          done();
        });
      });
      it('all 5 tables present', function(done) {
        db.queryDb('getNumberOfTables', [], function (err, rows, result) {
          if (err) return done(err);
           result.rows[0].count.should.equal('5');
          done();
        });
      });
    });

    describe('#findUserByUsername', function() {
        it('respond with no errors', function(done) {
          db.queryDb('findUserByUsername', [testUser.username], function (err, rows, result) {
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

    describe('#deleteUser', function() {
        it('respond with no error', function(done) {
          db.queryDb('deleteUser', [testUser_Id], function (err, rows, result) {
            if (err) return done(err);
            done();
          });
        });   
    });

    describe('#insertUser', function() {
        it('respond with 1 created user', function(done) {
          db.queryDb('insertUser', [testUser.username, testUser.fullName, testUser.email, testUser.role, testUser.api_key], function (err, rows, result) {
            if (err) return done(err);
            result.rowCount.should.equal(1);
            done();
          });
        });   
    });

    describe('#findUserByUsername', function() {
        it('respond with 1 found user', function(done) {
          db.queryDb('findUserByUsername', [testUser.username], function (err, rows, result) {
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

    describe('#deleteUser', function() {
        it('respond with 1 deleted user', function(done) {
          db.queryDb('deleteUser', [testUser_Id], function (err, rows, result) {
            if (err) return done(err);
            result.rowCount.should.equal(1);
            done();
          });
        });   
    });
});
