class Geocoder {
    constructor (latlng) {

        this.latlng = latlng;
        this.name = '';
        this.info = '';
        this.done = false;

    }

    geocode(line) {

        var geo = this;

        geocode_service.reverse().distance(500).latlng(this.latlng).run(function(error, result) {
            if (error) {
                console.log(error);
            }

            var reverse_address = result && result.address ? result.address : {};
            var enc_boroughs = [];
            var enc_neighborhoods = [];

            var borough = "None";
            var neighborhood = "None";

            var neighborhood_layer = leafletPip.pointInLayer([geo.latlng.lng, geo.latlng.lat], neighborhoods, true);
            if (neighborhood_layer.length > 0) {
                enc_boroughs.push(neighborhood_layer[0].feature.properties.borough);
                enc_neighborhoods.push(neighborhood_layer[0].feature.properties.neighborhood);
            }

            if (enc_neighborhoods.length > 0) {
                var enc_borough = enc_boroughs[0];
                borough = enc_borough;
                var enc_neighborhood = enc_neighborhoods[0];
                neighborhood = enc_neighborhood;
                geo.info = enc_borough + '<br />' + enc_neighborhood;
            }

            var street_address = reverse_address;
            if (street_name_from_geocode(street_address, neighborhood)) {
                finish_station_geocode(street_address, geo, line, borough, neighborhood);
                return;
            }

            // The default reverse-geocode hierarchy can prefer neighborhoods or POIs.
            // Ask specifically for the nearest street name when it does not return a street.
            L.esri.get('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode', {
                f: 'json',
                location: geo.latlng.lng + ',' + geo.latlng.lat,
                featureTypes: 'StreetName'
            }, function(street_error, street_result) {
                if (street_error) {
                    console.log(street_error);
                }
                var nearest_street = street_result && street_result.address ? street_result.address : {};
                finish_station_geocode(nearest_street, geo, line, borough, neighborhood);
            });
        });
    }
}

var geocode_service = L.esri.Geocoding.geocodeService();

function finish_station_geocode(street_address, geo, line, borough, neighborhood) {
    geo.name = street_name_from_geocode(street_address, neighborhood);
    if (!geo.name) {
        // Never substitute a neighborhood or city for the street-based station name.
        geo.name = 'Unnamed station';
    }

    var landmark_layer = leafletPip.pointInLayer([geo.latlng.lng, geo.latlng.lat], landmarks, true);
    if (landmark_layer.length > 0) {
        var landmark = landmark_layer[0].feature.properties;
        if (!is_in_array(landmark.name, ENC_LANDMARKS_NEVER_LABEL)) {
            geo.name = geo.name + ' - ' + landmark.name;
            if (ENC_LANDMARKS_ONLY_LABEL.indexOf(landmark.name) != -1) {
                geo.name = landmark.name;
            }
        }
    }

    geocode_to_station(geo, line, borough, neighborhood);
}

function street_name_from_geocode(address, neighborhood) {
    if (!address) {
        return '';
    }

    var address_type = String(address.Addr_type || '').toLowerCase();
    var has_street_match = address_type.indexOf('street') >= 0 ||
        address_type == 'pointaddress' || address_type == 'subaddress';
    if (!has_street_match) {
        return '';
    }
    var candidates = [address.Street, address.Address, address.ShortLabel, address.Match_addr, address.LongLabel];

    for (var i = 0; i < candidates.length; i++) {
        if (!candidates[i]) {
            continue;
        }
        var candidate = clean_address(String(candidates[i]).split(',')[0]);
        var normalized = candidate.toLowerCase();
        if (!candidate || normalized == String(neighborhood || '').toLowerCase() ||
            normalized == String(address.Neighborhood || '').toLowerCase() ||
            normalized == String(address.PlaceName || '').toLowerCase() ||
            normalized == String(address.City || '').toLowerCase()) {
            continue;
        }
        return candidate;
    }

    return '';
}

function clean_address(addr) {
    addr = String(addr || '').trim();
    // Remove a leading house number and Manhattan-style compass prefix while preserving
    // numbers that are part of a street name, such as "125th St".
    addr = addr.replace(/^\d+(?:-\d+)?\s+/, '');
    addr = addr.replace(/^(?:N|S|E|W|North|South|East|West)\.?\s+/i, '');
    addr = addr.replace(/\bPlz\b/g, 'Plaza');
    return addr.trim();
}

function fetch_station_name_candidates(station, callback) {
    if (Array.isArray(station.name_candidates) && station.name_candidates.length > 1) {
        callback(station.name_candidates.slice());
        return;
    }

    var location = station.marker.getLatLng();
    var latitude_step = 24 / 111320;
    var longitude_step = 24 / (111320 * Math.max(.2, Math.cos(location.lat * Math.PI / 180)));
    var points = [{lat: location.lat, lng: location.lng}];

    // Sampling around the station finds both streets at nearby intersections.
    [-1, 1].forEach(function(lat_direction) {
        [-1, 1].forEach(function(lng_direction) {
            points.push({
                lat: location.lat + latitude_step * lat_direction,
                lng: location.lng + longitude_step * lng_direction
            });
        });
    });
    points.push({lat: location.lat + latitude_step, lng: location.lng});
    points.push({lat: location.lat - latitude_step, lng: location.lng});
    points.push({lat: location.lat, lng: location.lng + longitude_step});
    points.push({lat: location.lat, lng: location.lng - longitude_step});

    var candidates = [];
    function add_candidate(name) {
        name = clean_address(name);
        if (!name || name.toLowerCase() == 'unnamed station') {
            return;
        }
        if (!candidates.some(function(candidate) { return candidate.toLowerCase() == name.toLowerCase(); })) {
            candidates.push(name);
        }
    }
    add_candidate(station.name);

    var remaining = points.length;
    points.forEach(function(point) {
        L.esri.get('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode', {
            f: 'json',
            location: point.lng + ',' + point.lat,
            featureTypes: 'StreetName'
        }, function(error, result) {
            if (!error && result && result.address) {
                add_candidate(street_name_from_geocode(result.address, station.neighborhood));
            }
            remaining--;
            if (remaining == 0) {
                callback(candidates);
            }
        });
    });
}
