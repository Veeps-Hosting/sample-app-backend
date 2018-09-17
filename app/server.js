var fs = require('fs');
var https = require('https');
var mysql = require('mysql');

// We're expecting: node server.js /foo/bar/config.json /foo/bar/tls.crt.key
if (process.argv.length !== 4) {
  throw "This Node.js app requires exactly two arguments to be passed to it: the path to a config file and the path to a private TLS cert key.";
}

var configPath = process.argv[2];
var config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

var privateTlsCertKeyPath = process.argv[3];
var privateTlsCertKey = fs.readFileSync(privateTlsCertKeyPath, 'utf8');

var hostname = "0.0.0.0";
var env = process.env.VPC_NAME || 'development';
var port = process.env.PORT || 3000;
var contextPath = process.env.CONTEXT_PATH || "/sample-app-backend";
var indexHtml = fs.readFileSync(__dirname + '/index.html');

var dbHost = process.env.DB_URL || "localhost:3306";
var dbUser = config.db_user;
var dbPassword = config.db_password;
var dbName = config.db_name;

var options = {
  ca: fs.readFileSync(__dirname + '/../tls/ca-' + env + '.crt.pem'),
  key: privateTlsCertKey,
  cert: fs.readFileSync(__dirname + '/../tls/cert-' + env + '.crt.pem')
};

var server = https.createServer(options, function (request, response) {
  console.log("Got request: " + request.url);

  switch (request.url) {
    case contextPath:
      writeResponse(response, 200, indexHtml);
      break;

    case contextPath + '/health':
      writeResponse(response, 200, "OK");
      break;

    case contextPath + '/greeting':
      writeResponse(response, 200, config.greeting);
      break;

    case contextPath + '/db':
      runDbQuery(dbHost, dbUser, dbPassword, dbName, function(err, data) {
        writeResponse(response, 200, "Response from DB: " + data, err);
      });
      break;

    default:
      writeResponse(response, 404, "Not found");
      break;
  }
});

server.listen(port, hostname);

console.log("Server running at https://" + hostname + ":" + port);

process.on('SIGINT', function() {
  process.exit();
});

var writeResponse = function(response, status, data, err) {
  response.writeHead(err ? 500 : status, {"Content-Type": "text/html"});
  if (err) {
    response.end(JSON.stringify(err));
  } else {
    response.end(data);
  }
};

var runDbQuery = function(host, user, password, dbName, callback) {
  // Strip the port number off the end of the host, if present
  host = host.replace(/\:[^/:]+$/, "");

  var config = {
    host: host,
    user: user,
    database: dbName,
    password: password
  };

  if (env !== 'development') {
    // In prod environments, use built-in RDS support: https://github.com/mysqljs/mysql#ssl-options
    config.ssl = "Amazon RDS";
  }

  var connection = mysql.createConnection(config);
  connection.connect();

  connection.query('SELECT 1 + 1 AS solution', function(err, results) {
    if (err) {
      callback(err);
    } else {
      callback(null, results[0].solution);
    }
  });
};

