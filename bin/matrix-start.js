#!/usr/bin/env node

const commandTimeoutSeconds = 30;
var async = require('async');
var debug;

async.series([
  require('./matrix-init'),
  function(cb) {
    debug = debugLog('start');
    Matrix.localization.init(Matrix.localesFolder, Matrix.config.locale, cb);
  },
  Matrix.validate.userAsync,
  Matrix.validate.deviceAsync,
  function(cb) {
    Matrix.firebaseInit(cb)
  }
], function (err) {
  
  var app = Matrix.pkgs[0];
  if (_.isUndefined(app) || !_.isString(app)) {
    console.log('\n> matrix start <app> - ' + t('matrix.help_start').grey + '\n');
    process.exit(1);
  }

  Matrix.helpers.trackEvent('app-start', { aid: app, did: Matrix.config.device.identifier });

  Matrix.api.device.setId(Matrix.config.device.identifier);
  console.log(t('matrix.start.starting_app') + ': ', app, Matrix.config.device.identifier);


  //Get the app id for name
  Matrix.firebase.app.getIDForName(app, function(err, appId) {
    if (err) return console.error(err);
    debug('appId>', appId);
    //Get the current status of app
    Matrix.firebase.app.getStatus(appId, function(status) {
      debug('Get current status: ' + Matrix.config.user.id + '>' + Matrix.config.device.identifier + '>' + appId + '>' + status);

      if (_.isUndefined(app)) {
        console.log('\n> matrix start ¬\n');
        console.log('\t    matrix start <app> -', t('matrix.start.help', { app: '<app>' }).grey)
        Matrix.endIt();
        //If the status of the app is different of active or error doesn't execute de start command
      } else if (status === 'active' || status === 'pending') {
        console.log(t('matrix.start.start_app_status_error') + ':', app, status.green);
        Matrix.endIt();
      } else {
        var commandTimeout;
        //
        // if (options.all) {
        //   //FIXME: hacky
        //   app = 'all-applications'
        // }

        Matrix.loader.start();

        //Watch the app status and verify if the behavior it's right
        Matrix.firebase.app.watchStatus(appId, function(status) {
          //stop command status behavior(inactive or error -> active)
          if (status === 'active') {
            clearTimeout(commandTimeout);
            Matrix.loader.stop();
            console.log(t('matrix.start.start_app_successfully') + ': ', app);
            Matrix.endIt();
          } else if (status === 'error') {
            clearTimeout(commandTimeout);
            Matrix.loader.stop();
            console.error('The application failed to start, please update it and try again. \nIf it keeps failing you may want to contact the developer.'.yellow);
            Matrix.endIt();
          }

        });
        //Send the start command
        Matrix.api.app.start(app, Matrix.config.device.identifier, function(err, res) {
          if (err) {
            Matrix.loader.stop();
            console.log(t('matrix.start.start_app_error') + ':', app, ' (' + err.message.red + ')');
            Matrix.endIt();
          }

          //add timeout to start command
          commandTimeout = setTimeout(function() {
            console.log(t('matrix.start.start_timeout'));
            Matrix.endIt();

          }, commandTimeoutSeconds * 1000);

        });
      } //else
    });
  });

});