var express = require("express");
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var querystring = require('querystring');
var cons = require('consolidate');
var randomstring = require("randomstring");
var __ = require('underscore');
__.string = require('underscore.string');

var app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
var authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information


/*
 * Add the client information in here
 */
var client = {
	"client_id": "oauth-client-1",
	"client_secret": "oauth-client-secret-1",
	"redirect_uris": ["http://localhost:9000/callback"]
};

var protectedResource = 'http://localhost:9002/resource';

var state = randomstring.generate();

var access_token = null;
var scope = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req, res) {
	var authorizeUrl = null;

	authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
		response_type: 'code', 
		client_id: client.client_id, 
		redirect_uri: client.redirect_uris[0], 
		state: state
	});

	/*
	 * Send the user to the authorization server
	 */
	res.redirect(authorizeUrl);
	
});

app.get('/callback', function(req, res){
	var formData = null;
	var headers = null;
	var response = null;
	var jsonResponse = null;

	console.log(req.query);

	if (req.query.state != state) {
		res.render('error', {error: 'State value didn\'t match'});
		return;
	}

	formData = qs.stringify({
		grant_type: 'authorization_code', 
		code: req.query.code, 
		redirect_uri: client.redirect_uris[0], 
	});

	headers = {
		'Content-Type': 'application/x-www-form-urlencoded', 
		'Authorization': 'Basic ' + encodeClientCredentials(client.client_id, client.client_secret)
	}

	response = request('POST', authServer.tokenEndpoint, {
		body: formData, 
		headers: headers
	});

	jsonResponse = JSON.parse(response.getBody());

	access_token = jsonResponse.access_token;

	res.render('index', {access_token: access_token, scope: scope});
	/*
	 * Parse the response from the authorization server and get a token
	 */
	
});

app.get('/fetch_resource', function(req, res) {
	var response = null;
	var jsonResponse = null;

	/*
	 * Use the access token to call the resource server
	 */

	 if (!access_token) {
		 res.render('error', {error: 'Missing access token'});
		 return;
	 }

	 response = request('POST', protectedResource, {
		 headers: {
			 'Authorization': 'Bearer ' + access_token
		 }
	 });
	
	 if (response.statusCode >= 200 && response.statusCode < 300) {
		 res.render('data', {resource: JSON.parse(response.getBody())});
	 } else {
		 res.render('error', {error: 'Protected resource returned code: ' + response.statusCode});
	 }
	 
});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}
	
	return url.format(newUrl);
};

var encodeClientCredentials = function(clientId, clientSecret) {
	return new Buffer(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

var server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
 
