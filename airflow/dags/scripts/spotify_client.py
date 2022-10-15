#!/usr/bin/env python
# coding: utf-8

import base64
import requests
import datetime
from urllib.parse import urlencode

class SpotifyAPI(object):
    access_token = None
    access_token_expires = datetime.datetime.now()
    access_token_expired = True
    client_id = None
    client_secret = None
    token_url = "https://accounts.spotify.com/api/token"
    
    def __init__(self, client_id, client_secret, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.client_id = client_id
            self.client_secret = client_secret
            
    def get_client_credentials(self):
        client_id = self.client_id
        client_secret = self.client_secret
        if client_secret == None or client_id == None:
            raise Exception("Must set client_id and client_secret")
        client_creds = f"{client_id}:{client_secret}"
        client_creds_b64 = base64.b64encode(client_creds.encode())
        return client_creds_b64.decode()
    
    def get_token_headers(self):
        client_creds_b64 = self.get_client_credentials()
        return {
            "Authorization": f"Basic {client_creds_b64}"
        }
    
    def get_token_data(self):
        return {
            "grant_type": "client_credentials"
        } 
    
    def perform_auth(self):
        token_url = self.token_url
        token_data = self.get_token_data()
        token_headers = self.get_token_headers()
        r = requests.post(token_url, data=token_data, headers=token_headers)
        if r.status_code not in range(200, 299):
            return False
        data = r.json()
        now = datetime.datetime.now()
        access_token = data['access_token']
        expires_in = data['expires_in'] # seconds
        expires = now + datetime.timedelta(seconds=expires_in)
        self.access_token = access_token
        self.access_token_expires = expires
        self.access_token_did_expire = expires < now
        return True

    def get_access_token(self): 
        token = self.access_token
        expires = self.access_token_expires
        now = datetime.datetime.now()
        if expires < now:
            self.perform_auth()
            return self.get_access_token()
        elif token == None:
            self.perform_auth()
            return self.get_access_token() 
        return token

    def get_resource_header(self):
        access_token = self.get_access_token()
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        return headers

    def get_resource(self, lookup_id, resource_type='albums', query_postfix='', version='v1'):
        endpoint = f"https://api.spotify.com/{version}/{resource_type}/{lookup_id}/{query_postfix}"
        headers = self.get_resource_header()
        r = requests.get(endpoint, headers=headers)
        if r.status_code not in range(200, 299):
            return {}
        return r.json()
    
    def test_endpoint(self, api_uri):
        endpoint = f"{api_uri}"
        headers = self.get_resource_header()
        r = requests.get(endpoint, headers=headers)
        print(r)
        if r.status_code not in range(200, 299):
            return {}
        return r.json()
    
    def get_artist(self, _id):
        return self.get_resource(_id, resource_type='artists')

    def get_related_artists(self, _id):
        return self.get_resource(_id, resource_type='artists', query_postfix='related-artists')
    
    def get_top_tracks(self, _id):
        return self.get_resource(_id, resource_type='artists', query_postfix='top-tracks?market=US')
    
    def get_playlist(self, _id):
        return self.get_resource(_id, resource_type='playlists')
        
    def get_playlist_artists(self, _id, limit=50, offset=0):
        return self.get_resource(_id, resource_type='playlists', query_postfix=f'tracks?fields=items(track(artists(id, name)))&limit={limit}&offset={offset}')
    
    def search_artist_by_genre(self, genre='hip hop', search_type='artist', limit=50, offset=0): # type
        headers = self.get_resource_header()
        endpoint = "https://api.spotify.com/v1/search"
        data = urlencode({"q": "genre:\"" + genre + "\"", "type": search_type.lower(), "limit": limit, "offset": offset})
        lookup_url = f"{endpoint}?{data}"
        r = requests.get(lookup_url, headers=headers)
        if r.status_code not in range(200, 299):  
            return {}
        return r.json()





