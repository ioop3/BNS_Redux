class Station {
    constructor(lat, lng, name, info, nameCandidates) {
        this.name = name;
        this.info = info;
        this.name_candidates = Array.isArray(nameCandidates) ? nameCandidates.filter(function(candidate) {
            return typeof candidate == 'string' && candidate.trim().length > 0;
        }) : (name ? [name] : []);
        this.borough = "None";
        this.neighborhood = "None";
        this.riders = 0.0;

        this.lines = []; // Lines that contain this station.
        //this.drawmaps = []; // Lines that contain this station within its draw map.
        this.transfers = [];

        this.id = station_id_generator.generate();

        this.marker = create_station_marker(this.id, [lat, lng]);

        this.active = true;
    }

    to_json() {
        var json = {
            "lat": this.marker.getLatLng().lat,
            "lng": this.marker.getLatLng().lng,
            "name": this.name,
            "name_candidates": this.name_candidates,
            "info": this.info,
            "riders": this.riders,
            "lines": this.lines,
            //"drawmaps": this.drawmaps,
            "id": this.id,
            "active": this.active
        };
        return json;
    }

    generate_popup() {

        var station_popup = L.popup({'className': 'station-popup'});

        var station_content = '<div class="station-name" id="station-'+this.id.toString()+'">'+this.name+'   <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i></div>';
        station_content += '<div class="station-content"><div class="station-info">'+this.info+'<br /><i class="fa fa-user" aria-hidden="true"></i> '+Math.round(this.riders).toString()+'</div>';
        station_content += '<div class="station-info subway-lines">';

        var html_css_combos = [];

        for (var i = 0; i < this.lines.length; i++) {
            var line = this.lines[i];
            var line_object = N_lines[line];
            if (!line_object || line_object.deleted) {
                continue;
            }
            var line_label = line_display_label(line_object);
            var html_css_combo = line_label + ' ' + line_object.css + ' ' + line_object.diamond;
            if (!is_in_array(html_css_combo, html_css_combos)) {
                var line_shape = line_label.length > 2 ? 'subway-line-long' : 'subway-line';
                var diamond_shape = line_object.diamond ? ' line-diamond' : '';
                station_content += '<div id="'+this.id.toString()+":"+line.toString()+'" class="tooltip subway-deletable '+line_shape+diamond_shape+'" style="background-color: '+line_object.color_bg+'; color: '+line_object.color_text+';">';
                if (line_shape == 'subway-line') {
                    station_content += '<div class="height_fix"></div>';
                }
                station_content += '<div class="content">'+escape_route_text(line_label)+'</div><span class="tooltiptext">Click to delete</span></div>';
                html_css_combos.push(html_css_combo);
            }
        }
        station_content += ' </div>';


        station_content += '<div class="station-buttons"><div class="station-content-button station-name-reroll" id="reroll-name-'+this.id.toString()+'">Name Reroll</div><div class="station-content-button station-transfer" id="transfer-'+this.id.toString()+'">Transfer</div>';

        if (N_active_line && !N_active_line.deleted && !is_in_array(N_active_line.id, this.lines)) {
            var active_label = line_display_label(N_active_line);
            var active_shape = active_label.length > 2 ? 'subway-line-long' : 'subway-line';
            var active_diamond = N_active_line.diamond ? ' line-diamond' : '';
            station_content += '<div class="station-content-button station-build line-'+N_active_line.id.toString()+'" id="build-'+this.id.toString()+'">Build <div class="subway-line-mini '+active_shape+active_diamond+'" style="background-color: '+N_active_line.color_bg+'; color: '+N_active_line.color_text+';">';
            if (active_shape == 'subway-line') {
                station_content += '<div class="height_fix"></div>';
            }
            station_content += '<div class="content">'+escape_route_text(active_label)+'</div></div></div>';
        }

        station_content += '<div class="station-content-button station-delete ';
        for (i = 0; i < this.lines.length; i++) {
            var line = this.lines[i];
            station_content += 'line-'+N_lines[line].id.toString()+' ';
        }
        station_content += '" id="delete-'+this.id.toString()+'">Delete</div>';
        station_content += '</div><div style="clear: both;"></div>';

        if (DEBUG_MODE) {
            station_content += '<div>'+this.id.toString()+'</div>';
        }

        station_content += '</div>';

        station_popup.setContent(station_content);

        this.marker.unbindPopup();
        this.marker.bindPopup(station_popup);

        return station_popup;
    }

    drawmaps() {
        var drawmaps = [];
        for (var i = 0; i < N_lines.length; i++) {
            if (!N_lines[i].deleted && N_lines[i].name != 'N/A' && is_in_array(this.id, N_lines[i].draw_map)) {
                drawmaps.push(N_lines[i].id);
            }
        }
        return drawmaps;
    }

    del() {

        // Remove the marker.
        if (!HEADLESS_MODE) {
            station_layer.removeLayer(this.marker);
        }

        // Set the station to "inactive".
        this.active = false;

        var impacted_lines = [];

        for (var i = 0; i < N_lines.length; i++) {

            // Remove from station array.
            if (is_in_array(this.id, N_lines[i].stations)) {
                if (!is_in_array(i, impacted_lines)) {
                    impacted_lines.push(i);
                }
                var station_id_index = N_lines[i].stations.indexOf(this.id);
                N_lines[i].stations.splice(station_id_index, 1);
            }

            // Remove from drawmap.
            if (is_in_array(this.id, N_lines[i].draw_map)) {
                if (!is_in_array(i, impacted_lines)) {
                    impacted_lines.push(i);
                }
                var station_id_index = N_lines[i].draw_map.indexOf(this.id);
                N_lines[i].draw_map.splice(station_id_index, 1);
            }

        }

        // Remove transfers
        for (var j = N_transfers.length - 1; j >= 0; j--) {
            var transfer = N_transfers[j];
            if (this.id == transfer.origin || this.id == transfer.end) {
                transfer.undraw();
                N_transfers.splice(j, 1);
            }
        }

        // Trigger ridership recalculation for nearby stations
        calculate_ridership(this.id, RIDERSHIP_DELETE);

    }

    set_marker_style() {

        if (lines_to_groups(this.drawmaps()).length >= STATION_MARKER_SCALE_THRESHOLD) {
            this.marker.setRadius(lines_to_groups(this.drawmaps()).length * TRACK_WIDTH / 2.0);
        } else if (lines_to_groups(this.drawmaps()).length >= STATION_MARKER_HUGE_THRESHOLD || this.lines.length > 12) {
            this.marker.setRadius(MARKER_RADIUS_HUGE);
        } else if (lines_to_groups(this.drawmaps()).length >= STATION_MARKER_LARGE_THRESHOLD || this.lines.length > 8) {
            this.marker.setRadius(MARKER_RADIUS_LARGE);
        }
        if (this.drawmaps().length > this.lines.length || this.lines.length == 1) {
            this.marker.setStyle({color: "white", fillColor: "black", weight: 2});
        } else {
            this.marker.setStyle({color: "black", fillColor: "white", weight: 3});
        }
    }
}

function geocode_to_station(geo, line, borough, neighborhood) {



    var N_station = new Station(geo.latlng.lat, geo.latlng.lng, geo.name, geo.info, geo.name_candidates);

    N_stations[N_station.id] = N_station;
    var new_index = N_active_line.insert_station(N_station.id);

    N_station.borough = borough;
    N_station.neighborhood = neighborhood;

    calculate_ridership(N_station.id, RIDERSHIP_ADD);

    N_station.marker.openPopup();

    var impacted_lines = [N_active_line.id];
    // Add drawmaps of nearby stations
    var start_index = Math.max(0, new_index - SHARED_STRETCH_THRESHOLD);
    var end_index = Math.min(new_index + SHARED_STRETCH_THRESHOLD, N_active_line.stations.length);
    for (var j = start_index; j < end_index; j++) {
        for (var k = 0; k < N_stations[N_active_line.stations[j]].drawmaps().length; k++) {
            var drawmaps = N_stations[N_active_line.stations[j]].drawmaps();
            if (!is_in_array(drawmaps[k], impacted_lines)) {
                impacted_lines.push(drawmaps[k]);
            }
        }
    }

    for (var i = 0; i < impacted_lines.length; i++) {
        N_lines[impacted_lines[i]].generate_draw_map();
        N_lines[impacted_lines[i]].generate_control_points();
    }
    for (var i = 0; i < impacted_lines.length; i++) {
        N_lines[impacted_lines[i]].draw();
    }

    station_layer.bringToFront();
    generate_route_diagram(line);

    calculate_total_ridership();

}

var N_stations = [];
