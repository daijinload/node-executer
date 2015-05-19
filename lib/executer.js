/**
 * @fileoverview 実行処理のユーティリティ
 * @author Atsushi Hashimoto <hashimoto_atsushi@cyberagent.co.jp>
 */

// therd party modules
var async = require('async');
var util = require('util');


/**
 * コンストラクタ
 * @param {array} jobs jobの配列
 * @param {{error: function}} setting セットアップ情報
 * @constructor
 */
function Executer(jobs, setting) {
    if (util.isArray(jobs)) {
        this.execList = jobs;
    } else {
        setting = jobs;
    }
    this.execList = this.execList || [];
    this.rollbackList = [];
    this.error = setting && setting.error || this.error;
}


/**
 * 実行対象のオブジェクトをキューイングします。
 * @param {{exec: function, rollback: function}} job ジョブ
 * @return {this}
 */
Executer.prototype.push = function(job) {
    this.execList.push(job);
    return this;
};


/**
 * 実行対象のオブジェクトをキューイングします。
 * @param {array} jobs ジョブの配列
 * @return {this}
 */
Executer.prototype.pushAll = function(jobs) {
    this.execList = this.execList.concat(jobs);
    return this;
};


/**
 * 実行します。実行結果の配列も返します。
 * @param {function} callback コールバック
 */
Executer.prototype.exec = function(callback) {
    var self = this;
    var _list = [];
    async.eachSeries(self.execList, function(job, next) {
        job.exec(function(err, result) {
            if (err) {
                next(err);
                return;
            }
            _list.push(result);
            self.rollbackList.push(job);
            next();
        }, _list);
    }, function(err) {
        if (err) {
            self._rollback(function(_err) {
                self.error(_err, function() {
                    // rollback時のエラーは、返さない。
                    callback(err, _list);
                });
            });
            return;
        }
        callback(null, _list);
    });
};


/**
 * ロールバックします。
 * @param {function} callback コールバック
 */
Executer.prototype._rollback = function(callback) {
    async.eachSeries(this.rollbackList, function(job, next) {
        job.rollback(next);
    }, callback);
};


/**
 * ロールバック時にエラーが起きた際の処理（ログを出力するなど上書き用）
 * @param {Error} err エラーオブジェクト
 * @param {function} callback コールバック
 */
Executer.prototype.error = function(err, callback) {
    callback(err);
};


/**
 * ロールバック時にエラーが起きた際の処理を設定
 * @param {function} func エラー関数
 * @return {this}
 */
Executer.prototype.setErrorFunc = function(func) {
    this.error = func;
    return this;
};


/**
 * Job コンストラクタ
 * @param {{exec: function, rollback: function}} setting セットアップ情報
 * @constructor
 */
function Job(setting) {
    this.exec = setting && setting.exec || this.exec;
    this.rollback = setting && setting.rollback || this.rollback;
}


/**
 * 実行用関数（定義忘れの場合、エラーがスローされるように）
 * @param {function} callback コールバック
 */
Job.prototype.exec = function(callback) {
    throw new Error('job no setup exec');
};


/**
 * ロールバック用関数（定義忘れの場合、エラーがスローされるように）
 * @param {function} callback コールバック
 */
Job.prototype.rollback = function(callback) {
    throw new Error('job no setup rollback');
};


/**
 * ロールバックしない設定の場合、空の関数を設定する。
 * @return {this}
 */
Job.prototype.unusedRollback = function() {
    this.rollback = Job.emptyFunction;
    return this;
};


/**
 * 空の関数実行用
 * @param {function} callback コールバック
 */
Job.emptyFunction = function(callback) {
    callback();
};


exports.Executer = Executer;
exports.Job = Job;
