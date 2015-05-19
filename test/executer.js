var should = require('should');
var sinon = require('sinon');

var executer = require('../lib/executer');
var Executer = executer.Executer;
var Job = executer.Job;

describe('lib/utils/executer.js', function() {

    describe('executer#Job', function() {

        it('オブジェクトを作成できる', function() {
            new Job().should.be.type('object');
        });

        it('オブジェクトをパラメータありで作成して実行できる', function() {
            var job = new Job({
                exec: function() {return 'str exec';},
                rollback: function() {return 'str rollback';}
            });
            job.exec().should.be.exactly('str exec');
            job.rollback().should.be.exactly('str rollback');
        });

        it('jobに設定せずに実行した場合、例外が投げられるはず', function() {
            var job = new Job();
            (function() { job.exec(); }).should.throw();
            (function() { job.rollback(); }).should.throw();
        });

    });

    describe('executer#Executer', function() {

        it('通常実行　jobを1個設定動くはず', function() {
            var executer = new Executer();
            var execSpy = sinon.spy();
            var rollbackSpy = sinon.spy();
            executer.push(new Job({
                exec: function(callback) {
                    execSpy();
                    callback();
                },
                rollback: function(callback) {
                    rollbackSpy();
                    callback();
                }
            }));
            executer.exec(function(err) {
                should.not.exist(err);
                execSpy.callCount.should.be.exactly(1);
                rollbackSpy.callCount.should.be.exactly(0);
            });
        });

        it('通常実行　pushをメソッドチェインできるはず', function() {
            var executer = new Executer();
            executer.push({}).push({}).push({});
            executer.execList.length.should.be.exactly(3);
        });

        it('通常実行　jobを10個設定しても動くはず', function() {
            var execNum = 10;
            var executer = new Executer();
            var execSpy = sinon.spy();
            var rollbackSpy = sinon.spy();
            for (var i = 0; i < execNum; i++) {
                executer.push(new Job({
                    exec: function(callback) {
                        execSpy();
                        callback();
                    },
                    rollback: function(callback) {
                        rollbackSpy();
                        callback();
                    }
                }));
            }
            executer.exec(function(err) {
                should.not.exist(err);
                execSpy.callCount.should.be.exactly(execNum);
                rollbackSpy.callCount.should.be.exactly(0);
            });
        });

        it('エラー発生時ロールバックするはず', function() {
            var executer = new Executer();
            var list = [
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()},
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()},
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()}
            ];
            var errors = [null, null, new Error()];

            for (var i = 0; i < list.length; i++) {
                (function() {
                    var idx = i;
                    executer.push(new Job({
                        exec: function(callback) {
                            list[idx].execSpy();
                            callback(errors[idx]);
                        },
                        rollback: function(callback) {
                            list[idx].rollbackSpy();
                            callback();
                        }
                    }));
                })();
            }

            executer.exec(function(err) {
                should.exist(err);
                list[0].execSpy.callCount.should.be.exactly(1);
                list[1].execSpy.callCount.should.be.exactly(1);
                list[2].execSpy.callCount.should.be.exactly(1);
                list[0].rollbackSpy.callCount.should.be.exactly(1);
                list[1].rollbackSpy.callCount.should.be.exactly(1);
                list[2].rollbackSpy.callCount.should.be.exactly(0);
            });
        });
    });

    describe('executer#Job#emptyFunction', function() {
        it('ロールバック不要時の空の関数が動くはず', function() {
            Job.emptyFunction(function(err) {
                should.not.exist(err);
            });
        });
    });

    describe('executer#error', function() {
        it('ロールバックエラー時に、エラー関数が呼ばれるはず', function() {
            var executer = new Executer();

            var errorSpy = sinon.spy();

            executer.error = function(err, callback) {
                errorSpy();
                callback(err);
            };

            executer.push(new Job({
                exec: function(callback) {
                    callback(new Error());
                },
                rollback: Job.emptyFunction
            }));
            executer.exec(function(err) {
                should.exist(err);
                errorSpy.callCount.should.be.exactly(1);
            });
        });

        it('セットアップを変えても、エラー関数が呼ばれるはず', function() {
            var errorSpy = sinon.spy();

            var executer = new Executer({error: function(err, callback) {
                errorSpy();
                callback(err);
            }});

            executer.push(new Job({
                exec: function(callback) {
                    callback(new Error());
                },
                rollback: Job.emptyFunction
            }));

            executer.exec(function(err) {
                should.exist(err);
                errorSpy.callCount.should.be.exactly(1);
            });
        });
    });

    describe('executer#unusedRollback', function() {
        it('ロールバック関数に空関数が設定されエラーがスローされないはず', function() {

            var job = new Job();

            job.exec = function(callback) {
                callback(new Error());
            };

            job.unusedRollback();

            new Executer([job]).exec(function(err) {
                should.exist(err);
            });
        });
    });

    describe('executer#pushAll', function() {
        it('ジョブを複数一気に登録できるはず', function() {

            var oneExecSpy = sinon.spy();
            var oneRollbackSpy = sinon.spy();

            var job = new Job({
                exec: function(callback) {
                    oneExecSpy();
                    callback();
                },
                rollback: function(callback) {
                    oneRollbackSpy();
                    callback();
                }
            });

            var executer = new Executer([job]);

            var list = [
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()},
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()},
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()}
            ];
            var errors = [
                function() {},
                function() {},
                function() {return new Error();}
            ];
            var jobs = [];
            for (var i = 0; i < list.length; i++) {
                (function() {
                    var idx = i;
                    jobs.push(new Job({
                        exec: function(callback) {
                            list[idx].execSpy();
                            callback(errors[idx]());
                        },
                        rollback: function(callback) {
                            list[idx].rollbackSpy();
                            callback(errors[idx]());
                        }
                    }));
                })();
            }

            executer.pushAll(jobs).exec(function(err) {
                should.exist(err);
                oneExecSpy.callCount.should.be.exactly(1);
                oneRollbackSpy.callCount.should.be.exactly(1);
                list[0].execSpy.callCount.should.be.exactly(1);
                list[1].execSpy.callCount.should.be.exactly(1);
                list[2].execSpy.callCount.should.be.exactly(1);
                list[0].rollbackSpy.callCount.should.be.exactly(1);
                list[1].rollbackSpy.callCount.should.be.exactly(1);
                list[2].rollbackSpy.callCount.should.be.exactly(0);
            });
        });
    });

    describe('executer#setErrorFunc', function() {
        it('ロールバック時のエラー関数を設定できるはず', function() {

            var list = [
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()},
                {execSpy: sinon.spy(), rollbackSpy: sinon.spy()}
            ];

            var jobs = [];
            jobs.push(new Job({
                exec: function(callback) {
                    list[0].execSpy();
                    callback();
                },
                rollback: function(callback) {
                    list[0].rollbackSpy();
                    callback(new Error());
                }
            }));
            jobs.push(new Job({
                exec: function(callback) {
                    list[1].execSpy();
                    callback(new Error());
                },
                rollback: function(callback) {
                    list[1].rollbackSpy();
                    callback();
                }
            }));

            var errorFunc = sinon.spy();

            new Executer(jobs).setErrorFunc(function(err, callback) {
                errorFunc();
                callback(err);
            }).exec(function(err) {
                should.exist(err);
                errorFunc.callCount.should.be.exactly(1);
                list[0].execSpy.callCount.should.be.exactly(1);
                list[1].execSpy.callCount.should.be.exactly(1);
                list[0].rollbackSpy.callCount.should.be.exactly(1);
                list[1].rollbackSpy.callCount.should.be.exactly(0);
            });
        });
    });
});
