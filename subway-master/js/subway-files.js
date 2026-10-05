function handle_files(files) {
    if (!files || !files.length) {
        return;
    }

    var reader = new FileReader();
    reader.onload = function(event) {
        try {
            load_game_json(JSON.parse(event.target.result));
            $('#starter').hide();
        } catch (error) {
            window.alert('This save file could not be loaded: ' + error.message);
        }
    };
    reader.readAsText(files[0]);
}

function handle_server_file(file) {
    $.getJSON(file).done(function(data) {
        try {
            load_game_json(data);
            $('#starter').hide();
        } catch (error) {
            window.alert('This preset could not be loaded: ' + error.message);
        }
    }).fail(function(xhr, textStatus) {
        if (window.location.protocol === 'file:') {
            window.alert('Start-date maps need the game to be served over HTTP. From the project folder, run `npx http-server`, then open the localhost address it prints. Browsers block preset JSON files when the page is opened directly as a file.');
            return;
        }
        window.alert('Could not load ' + file + ' (HTTP ' + (xhr.status || textStatus) + '). Make sure the server is running from the project folder.');
    });
}

function load_game_json(data) {
    if (!data || !Array.isArray(data.lines) || !Array.isArray(data.stations)) {
        throw new Error('The save file does not contain subway lines and stations.');
    }

    initialize_game_state();
    $('#custom-lines').empty().hide();
    var saved_lines = data.lines.slice(0).sort(function(a, b) {
        return Number(a.id) - Number(b.id);
    });

    for (var i = 0; i < saved_lines.length; i++) {
        var record = saved_lines[i];
        if (record.id == null || Number(record.id) < 0 || !isFinite(Number(record.id))) {
            continue;
        }
        var line_id = Number(record.id);
        while (N_lines.length <= line_id) {
            var placeholder = new Line('N/A', 'N/A', 'subway-line-long', '#808183', '#FFFFFF');
            placeholder.deleted = true;
            N_lines.push(placeholder);
        }
        var line = N_lines[line_id];
        line.id = line_id;
        if (record.name != null) { line.name = record.name; }
        if (record.html != null) { line.html = record.html; }
        if (record.css != null) { line.css = record.css; }
        if (record.color_bg != null) { line.color_bg = record.color_bg; }
        if (record.color_text != null) { line.color_text = record.color_text; }
        line.stations = Array.isArray(record.stations) ? record.stations.slice(0) : [];
        line.draw_map = Array.isArray(record.draw_map) ? record.draw_map.slice(0) : line.stations.slice(0);
        // Some exported presets include empty N/A slots marked as active.
        // Keep those placeholders out of station and route grouping logic.
        line.deleted = record.deleted === true || line.name == 'N/A';
        if (record.branch != null) { line.branch = !!record.branch; }
        if (record.variant_parent_id != null) { line.variant_parent_id = Number(record.variant_parent_id); }
        if (record.variant_kind != null) { line.variant_kind = record.variant_kind; }
        if (record.variant_suffix != null) { line.variant_suffix = record.variant_suffix; }
        if (record.route_base_name != null) { line.route_base_name = record.route_base_name; }
        if (record.route_suffix != null) { line.route_suffix = record.route_suffix; }
        if (record.diamond != null) { line.diamond = !!record.diamond; }
    }
    if (data.next_line_id != null) {
        line_id_generator.currentId = Math.max(line_id_generator.currentId, Number(data.next_line_id));
    }

    var fix_boroughs = false;
    for (var j = 0; j < data.stations.length; j++) {
        var station_data = data.stations[j];
        var station = new Station(station_data.lat, station_data.lng, station_data.name, station_data.info, station_data.name_candidates);
        station.riders = Number(station_data.riders) || 0;
        station.lines = Array.isArray(station_data.lines) ? station_data.lines.filter(function(line_id) {
            return N_lines[line_id] && !N_lines[line_id].deleted;
        }) : [];
        N_stations[station.id] = station;
        if (station.borough == 'None') {
            fix_boroughs = true;
        }
        if (station_data.active === false) {
            station.del();
        }
    }

    // Line station membership is authoritative. Rebuild each active station's line list
    // so saves from the original site and newer edited saves agree on both sides.
    N_stations.forEach(function(station) {
        if (station) {
            station.lines = [];
        }
    });
    N_lines.forEach(function(line) {
        line.stations = line.stations.filter(function(station_id) {
            return !line.deleted && N_stations[station_id] && N_stations[station_id].active;
        });
        line.draw_map = line.stations.slice(0);
        line.stations.forEach(function(station_id) {
            if (!is_in_array(line.id, N_stations[station_id].lines)) {
                N_stations[station_id].lines.push(line.id);
            }
        });
    });

    if (fix_boroughs) {
        futz_boroughs();
    }

    rebuild_line_groups();
    var active_line_id = data.active_line_id != null ? Number(data.active_line_id) : 0;
    N_active_line = N_lines[active_line_id] && !N_lines[active_line_id].deleted ? N_lines[active_line_id] : null;
    if (!N_active_line) {
        N_active_line = N_lines.find(function(candidate) { return !candidate.deleted && candidate.name != 'N/A'; }) || null;
    }

    for (var k = 0; k < N_lines.length; k++) {
        if (!N_lines[k].deleted && N_lines[k].name != 'N/A') {
            N_lines[k].generate_draw_map();
            N_lines[k].generate_control_points();
        }
    }
    for (var m = 0; m < N_lines.length; m++) {
        if (!N_lines[m].deleted && N_lines[m].name != 'N/A') {
            N_lines[m].draw();
        }
    }

    N_transfers = [];
    var saved_transfers = Array.isArray(data.transfers) ? data.transfers : [];
    for (var q = 0; q < saved_transfers.length; q++) {
        var transfer_data = saved_transfers[q];
        if (N_stations[transfer_data.s] && N_stations[transfer_data.s].active &&
            N_stations[transfer_data.e] && N_stations[transfer_data.e].active) {
            var transfer = new Transfer(transfer_data.s, transfer_data.e);
            transfer.draw();
            N_transfers.push(transfer);
        }
    }

    if (N_active_line) {
        $('.subway-clickable').removeClass('subway-selected');
        $('#line-option-' + N_active_line.id).addClass('subway-selected');
    }
    if (!HEADLESS_MODE) {
        station_layer.bringToFront();
    }
    regenerate_popups();
    render_line_selectors();
    generate_route_diagram(N_active_line);
    recalculate_all_ridership(RIDERSHIP_ADD);
    calculate_total_ridership();
}

function save_game_json() {
    var json = {
        format: 'brand-new-subway-save',
        schema_version: 2,
        lines: [],
        stations: [],
        transfers: [],
        active_line_id: N_active_line ? N_active_line.id : null,
        next_line_id: line_id_generator.currentId,
        version: GAME_VERSION
    };

    for (var i = 0; i < N_lines.length; i++) {
        json.lines.push(N_lines[i].to_json());
    }
    for (var j = 0; j < N_stations.length; j++) {
        if (N_stations[j]) {
            json.stations.push(N_stations[j].to_json());
        }
    }
    for (var k = 0; k < N_transfers.length; k++) {
        json.transfers.push(N_transfers[k].to_json());
    }

    var blob = new Blob([JSON.stringify(json)], {type: 'application/json;charset=utf-8'});
    saveAs(blob, 'bns_saved_game.json', {autoBom: false});
}
