#!/usr/bin/env node

var fs = require('fs');
var tar = require('tar');
var prompt = require('prompt');
var yaml = require('js-yaml');
var pwd = process.cwd();
var async = require('async')

var debug;

async.series([
  require('./matrix-init'),
  function (cb) {
    Matrix.loader.start();
    debug = debugLog('create');
    Matrix.localization.init(Matrix.localesFolder, Matrix.config.locale, cb);
  },

], function(err) {
  if (err) {
    Matrix.loader.stop();
    console.error(err.message.red);
    debug('Error:', err.message);
    return process.exit(1);
  }

  var app = Matrix.pkgs[0];

  if (parseInt(app) === app) {
    Matrix.loader.stop();
    console.error(t('matrix.create.bad_numbers'))
    process.exit(1);
  }

  function onError(err) {
    Matrix.loader.stop();
    console.error(t('matrix.create.error_creating') + ':', err);
    process.exit(1);
  }

  // to write to disk after prompt
  var configString;

  // check if path already exists, refuse if so
  fs.access(process.cwd() + "/" + app, fs.F_OK, function(err) {
    if (!err) {
      Matrix.loader.stop();
      console.error(t('matrix.create.error_creating') + ':', t('matrix.create.folder_exist'));
      process.exit(1);
    } else {
      var nameP = {
        name: 'name',
        description: 'App Name',
        pattern: /\w|\n|-/,
        message: 'App name must be a single word. Use - for multi word app names',
        required: true
      };

      var descP = {
        name: 'description',
        description: 'Description',
        required: true
      }

      var keyP = {
        name: 'keywords',
        description: 'Keywords',
      }

      prompt.delimiter = '';
      prompt.message = 'Create new application -- ';

      var ps = [descP, keyP];

      if (_.isUndefined(app)) {
        // nop app mentioned
        ps.unshift(nameP)
      } else {
        prompt.message += ' ( ' + app + ' ) ';
      }

      Matrix.loader.stop();      
      prompt.start();
      prompt.get(ps, function(err, results) {

        if (err) {
          if (err.toString().indexOf('canceled') > 0) {
            console.log('');
            process.exit();
          } else {
            console.log("Error: ", err);
            process.exit();
          }
        }

        debug(results);

        if (_.isUndefined(app)) {
          // no app name defined
          app = results.name;
        } else {
          // app name defined
          results.name = app;
        }
        results.shortName = results.name.replace(/\s/g, '-');
        //Add a display name
        results.displayName = _.startCase(results.name);

        // write the config yaml
        configString = yaml.safeDump(results);

        debug('Writing config...', configString);

        Matrix.loader.start();

        var extractor = tar.Extract({
            path: pwd + "/" + app,
            strip: 1
          })
          .on('error', onError)
          .on('end', function onFinishedExtract() {

            Matrix.helpers.trackEvent('app-create', { aid: app });

            Matrix.loader.stop();

            fs.writeFileSync(app + '/config.yaml', '\n' + configString, { flag: 'a' });

            changeNameP = require(pwd + "/" + app + '/package.json');
            changeNameP.name = app;
            Matrix.helpers.changeName(changeNameP, pwd + "/" + app + '/package.json', function(err) {
              if (err) {
                console.error('Error updating package.json file: ' + err.message.red);
                process.exit(1);
              }
            });

            console.log(t('matrix.create.new_folder') + ':>'.grey, app.green + '/'.grey);
            console.log('         app.js'.grey, '-', t('matrix.create.description_app'))
            console.log('    config.yaml'.grey, '-', t('matrix.create.description_config'))
            console.log('      README.MD'.grey, '-', t('matrix.create.description_developer'))
            console.log('       index.js'.grey, '-', t('matrix.create.description_index'))
            console.log('   package.json'.grey, '-', t('matrix.create.description_package'))
            process.exit(1);
          });

        fs.createReadStream(__dirname + "/../baseapp.tar")
          .on('error', onError)
          .pipe(extractor);
        // unzip baseApp.zip to named folder
      });
    }
  });

  function displayHelp() {
    console.log('\n> matrix create ¬\n');
    console.log('\t    matrix create <app> -', t('matrix.create.help', { app: '<app>' }).grey)
    console.log('\n')
    process.exit(1);
  }
});