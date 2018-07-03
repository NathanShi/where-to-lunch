'use babel';

import { CompositeDisposable } from 'atom';
import { GOOGLE_API_URL, GET_API_WEBSITE, GEOCODER_WEBSITE, REGEX_GEOCODE } from './constant'
var request = require('request')
var notification = require('atom').Notification

export default {
  config: {
    useMapApi:{
      title: 'Use Google map api to generate restaurant list',
      type: 'boolean',
      default: false,
      description: 'Would you like to use google map to generate nearby restaurant list for your?',
      order: 1
    },
    googleApiKey:{
      title: 'Google Map API Key',
  		type: 'string',
      default: '',
  		description: `Please go to **[API Generator](${GET_API_WEBSITE})** to get your own keys`,
  		order: 2
    },
    location:{
      title: 'Geo-Location',
      type: 'string',
      default: '41.8824178,-87.6275838',
      description: `You can go to **[Geocoder](${GEOCODER_WEBSITE})** to get coordinate information, please separate by ','`,
      order: 3
    },
    restaurant_lists: {
      title: 'Restaurants List',
      type: 'string',
      default: 'Greek Kitchen, Roti',
      description: 'This will update automatically OR **You can set your own pool (please follow the syntax)**',
      order: 4
    },
    preference: {
      type: 'object',
      properties: {
        keyword: {
          title: 'Keyword',
          type: 'string',
          default: '',
          description: 'Add your keywords when generating restaurant list',
          order: 1
        },
        radius: {
          title: 'Radius',
          type: 'integer',
          default: 300,
          minimum: 100,
          maximum: 2000,
          description: 'How far do you like to search(in meters)',
          order: 2
        },
        max_price: {
          title: 'Max Price',
          type: 'integer',
          default: 3,
          enum: [1, 2, 3, 4],
          description: 'Set your max price between 0 (most affordable) to 4 (most expensive)',
          order: 3
        },
        open_now: {
          title: 'Open Now',
          type: 'boolean',
          default: true,
          description: 'Only search for restaurant opened',
          order: 4
        }
      }
    }
  },

  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that pick the restaurant
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'where-to-lunch:random-pick': () => this.pickRestaurant()
    }));

    // Register command that let user edit config
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'where-to-lunch:edit': () => this.showConfig()
    }));

    atom.config.onDidChange('where-to-lunch.location', (value) => {
      this.getAndSetLocations();
    });
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {},

  //Get location coordinate by Google Map 'textsearch' API & set in config.
  getAndSetLocations() {
    let loc = atom.config.get('where-to-lunch.location').match(REGEX_GEOCODE).join(',');
    let key = atom.config.get('where-to-lunch.googleApiKey');
    let preference = atom.config.get('where-to-lunch.preference');

    let url = GOOGLE_API_URL + 'nearbysearch/json?location=' + loc;
    url += '&radius=' + preference.radius.toString();
    url += '&maxprice=' + preference.max_price.toString();
    url += '&opennow=' + preference.open_now.toString();
    if (preference.keyword.length != 0){
      url += '&keyword=' + preference.keyword;
    }
    url += '&type=restaurant&key=' + key;

    request.get(url, (err, res, body) => {
      if (res.statusCode == 200 && JSON.parse(body)['results'].length > 0) {
        let obj = JSON.parse(body)['results'];
        var List = [];
        var restaurant = {};
        for (const restaurantInfo of obj){
          restaurant.name     = restaurantInfo['name'];
          restaurant.rating   = restaurantInfo['rating'];
          restaurant.vicinity = restaurantInfo['vicinity'];
          List.push(JSON.stringify(restaurant));
        }
        atom.config.set('where-to-lunch.restaurant_lists', JSON.stringify(List));
      }else{
        this.showNotification('error', 'Unable to get restaurants, please check your address');
      }
    })
  },

  //KeyMap: 'ctrl-alt-p', use restaurants list to random pick a result for user.
  pickRestaurant() {
    let winner = {};
    let restaurants = [];
    let listString = atom.config.get('where-to-lunch.restaurant_lists');
    if (listString.indexOf('\\') != -1){
      restaurants = JSON.parse(atom.config.get('where-to-lunch.restaurant_lists'));
      winner = JSON.parse(restaurants[~~(Math.random() * restaurants.length)]);
    }else{
      restaurants = listString.split(',').map(item => item.trim());
      winner = { "name" : restaurants[~~(Math.random() * restaurants.length)]};
    }

    var str = '<span style="font-weight:bold">Voilà</span>, the winner is:<br>';
    str += 'restaurant: <span style="font-weight:bold">' + winner.name + '</span>';
    if (winner.hasOwnProperty('rating'))
      str += '<br>rate: ' + winner.rating;
    if (winner.hasOwnProperty('vicinity'))
      str += '<br>address: ' + winner.vicinity;

    this.showNotification('success', str);
  },

  //Show configuration of where-to-lunch package.
  showConfig() {
    atom.workspace.open('atom://config/packages/where-to-lunch');
  },

  //Show notifications of results or error messages.
  showNotification(type, message){
    n = new notification(type, message, {dismissable: true});
    n.onDidDisplay;
    atom.notifications.addNotification(n);
  }

};
