(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";function authorize(e){return SECRET_HASH.then(function(t){return pbkdf2(e).then(function(e){return e.value===t.value})})}function onEmit(e){debug("account-example:accept:")(e)}var src_1=require("../../src"),pbkdf2sha512_1=require("pbkdf2sha512"),debug=require("debug");debug.enable("account-example:*");var pbkdf2=pbkdf2sha512_1.default({iterations:8192}),SECRET_HASH=pbkdf2("secret passphrase"),accountFromDoc=src_1.default(authorize,onEmit,{include_docref:!0}),doc=accountFromDoc({_id:"id",_rev:"rev",url:"https://example.com"});debug("account-example:from-doc:")(doc);var accountFromObject=src_1.default(authorize,onEmit),empty=accountFromObject({unrestricted:!0});debug("account-example:from-object:unrestricted-empty:")(empty);var bookmark=empty.set({url:"https://zenyway.com"}).then(debug("account-example:from-object:unrestricted-bookmark:")),account=accountFromObject({_id:"id",_rev:"rev",url:"https://secure.example.com",username:"j.doe@example.com",password:"secret password"});debug("account-example:from-object:restricted-account:")(account),account.password("secret passphrase").then(debug("account-example:from-object:restricted-account:password:"));var unrestricted=account.set({unrestricted:!0},"secret passphrase");unrestricted.then(debug("account-example:from-object:unrestricted-account:")),unrestricted.then(function(e){return e.password()}).then(debug("account-example:from-object:unrestricted-account:password:")),unrestricted.then(function(e){return e.emit()});
},{"../../src":3,"debug":undefined,"pbkdf2sha512":undefined}],2:[function(require,module,exports){
"use strict";function tokenizeURL(t,e){var r=utils_1.isString(e)&&t(e),i=r.hostname,n=r.pathname,s=utils_1.isString(i)?i.split(".").reverse():[],o=utils_1.isString(n)?n.split("/"):[];return s.slice(1).concat(s[0],o).filter(isNotEmpty)}function isNotEmpty(t){return!(!t||!t.length)}function tokenizeEmail(t,e){if(!utils_1.isString(e))return[];var r=e.split("@"),i=r[0],n=r[1],s=n?tokenizeURL(t,"mailto:"+n):[];return s.concat(i).filter(isNotEmpty)}var utils_1=require("./utils"),parseURL=require("url").parse,getDocIdGenerator=function(t){var e=t&&t.parseURL||parseURL;return function(t,r,i){var n=tokenizeURL(e,r),s=tokenizeEmail(e,i);return[t].concat(s,n).join("/")}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.default=getDocIdGenerator;

},{"./utils":4,"url":undefined}],3:[function(require,module,exports){
"use strict";function freepass(){return TRUE}function getDefaultName(t){if(!t.url||!t.url.length)return"";var e=parseURL(t.url).host;if(!utils_1.isString(e)||!e.length)return"";var n=e.split("."),r=n.length-2;return r<0?"":n[r]}function toDocId(t){return getDocId(t.name,t.url,t.username)}function toDocRef(t){var e=t&&utils_1.isString(t._id)&&t._id;if(!e)return{};var n=utils_1.isString(t._rev)&&t._rev;return n?{_id:e,_rev:n}:{_id:e}}function deleteDocRev(t){return delete t._rev,t}function noop(){}function sanitizeAccountObject(t){return t?Object.getOwnPropertyNames(IS_VALID_ACCOUNT_OBJECT_ENTRY).filter(function(e){return e in t}).reduce(function(e,n){if(IS_VALID_ACCOUNT_OBJECT_ENTRY[n](t[n])){var r=t[n];e[n]=Array.isArray(r)?r.slice():r}return e},{}):{}}function isStrings(t){return Array.isArray(t)&&t.every(utils_1.isString)}var utils_1=require("./utils"),id_components_1=require("./id-components"),tslib_1=require("tslib"),parseURL=require("url").parse,ACCOUNT_OBJECT_DEFAULTS={name:"",url:"",username:"",password:"",keywords:[],comments:"",login:!1,unrestricted:!1},IS_VALID_ACCOUNT_OBJECT_ENTRY={name:utils_1.isString,url:utils_1.isString,username:utils_1.isString,password:utils_1.isString,keywords:isStrings,comments:utils_1.isString,login:utils_1.isBoolean,unrestricted:utils_1.isBoolean,_deleted:utils_1.isBoolean},getAccountFactory=function(t,e,n){return function(r){return _AccountBuilder.getInstance(t,e,n).withProperties(r).withBasicDefaults().withDefaultNameAndId().withDocRef(r).toAccount()}},_AccountBuilder=function(){function t(t,e,n,r,i,s){void 0===s&&(s={}),this.includeDocRef=t,this.authorize=e,this.onEmit=n,this.getDocId=r,this.getName=i,this.account=s}return t.getInstance=function(e,n,r){var i=r&&r.include_docref,s=utils_1.isFunction(e)?e:freepass,o=utils_1.isFunction(n)?n:noop,u=r&&r.getId||toDocId,c=r&&r.no_default_name?noop:getDefaultName;return new t(i,s,o,u,c)},t.prototype.withProperties=function(t){var e=sanitizeAccountObject(t);return Object.getOwnPropertyNames(e).length?this.getInstance(tslib_1.__assign({},this.account,e)).withDefaultNameAndId():this},t.prototype.withDocRef=function(t){var e=this.includeDocRef&&toDocRef(t);return e&&e._id?this.getInstance(tslib_1.__assign({},this.account,e)):this},t.prototype.withBasicDefaults=function(){var t=this,e=Object.getOwnPropertyNames(ACCOUNT_OBJECT_DEFAULTS).reduce(function(e,n){return e[n]=n in t.account?t.account[n]:ACCOUNT_OBJECT_DEFAULTS[n],e},{});return this.getInstance(e)},t.prototype.withDefaultNameAndId=function(){return this.withDefaultName().withDefaultId()},t.prototype.isUnrestrictedUpdate=function(t){var e=t.account;return this.account.unrestricted||!e._deleted&&!e.unrestricted&&!utils_1.isString(e.password)},t.prototype.toAccount=function(){var t=this,e=this.account;return{get _id(){return e._id},get _deleted(){return e._deleted},get name(){return e.name},get url(){return e.url},get username(){return e.username},get keywords(){return e.keywords.slice()},get comments(){return e.comments},get login(){return e.login},get unrestricted(){return e.unrestricted},password:function(n){return t.assertPassphrase(e.unrestricted,n).then(function(t){return e.password})},set:function(e,n){var r=this,i=t.withProperties(e);return t===i?Promise.resolve(this):t.assertPassphrase(t.isUnrestrictedUpdate(i),n).then(function(t){return t?i.withDefaultNameAndId().toAccount():r})},emit:function(){return t.onEmit(e)}}},t.prototype.getInstance=function(e){return new t(this.includeDocRef,this.authorize,this.onEmit,this.getDocId,this.getName,e)},t.prototype.withDefaultName=function(){var t=this.account.name||this.getName(this.account);return t&&t!==this.account.name?this.getInstance(tslib_1.__assign(this.account,{name:t})):this},t.prototype.withDefaultId=function(){var t=this.getDocId(this.account);return t===this.account._id?this:this.getInstance(deleteDocRev(tslib_1.__assign({},this.account,{_id:t})))},t.prototype.assertPassphrase=function(t,e){return Promise.resolve(t||this.authorize(e)).then(function(t){return t||Promise.reject(new Error("invalid passphrase"))})},t}(),TRUE=Promise.resolve(!0),getDocId=id_components_1.default();Object.defineProperty(exports,"__esModule",{value:!0}),exports.default=getAccountFactory;
},{"./id-components":2,"./utils":4,"tslib":undefined,"url":undefined}],4:[function(require,module,exports){
"use strict";function isString(n){return"string"==typeof(n&&n.valueOf())}function isBoolean(n){return"boolean"==typeof(n&&n.valueOf())}function isFunction(n){return"function"==typeof n}exports.isString=isString,exports.isBoolean=isBoolean,exports.isFunction=isFunction;
},{}]},{},[1]);