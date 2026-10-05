function rebuild_line_groups() {
    var old_groups = N_line_groups || [];
    var groups = [];

    for (var i = 0; i < old_groups.length; i++) {
        var old_color = old_groups[i].name;
        var group_lines = [];
        for (var j = 0; j < N_lines.length; j++) {
            if (!N_lines[j].deleted && N_lines[j].name != 'N/A' && N_lines[j].color_bg == old_color) {
                group_lines.push(N_lines[j].id);
            }
        }
        if (group_lines.length > 0) {
            groups.push(new LineGroup(old_color, group_lines));
        }
    }

    for (var k = 0; k < N_lines.length; k++) {
        var line = N_lines[k];
        if (line.deleted || line.name == 'N/A') {
            continue;
        }
        var already_grouped = false;
        for (var m = 0; m < groups.length; m++) {
            if (groups[m].name == line.color_bg) {
                already_grouped = true;
                break;
            }
        }
        if (!already_grouped) {
            groups.push(new LineGroup(line.color_bg, [line.id]));
        }
    }

    N_line_groups = groups;
}

function render_line_selectors() {
    var selector = $('#line-selector-list');
    if (!selector.length) {
        return;
    }
    selector.empty();
    rebuild_line_groups();

    for (var i = 0; i < N_line_groups.length; i++) {
        var group = $('<div class="subway-line-group"></div>');
        group.css('border-color', N_line_groups[i].name);
        for (var j = 0; j < N_line_groups[i].lines.length; j++) {
            var line = N_lines[N_line_groups[i].lines[j]];
            if (!line || line.deleted || line.name == 'N/A') {
                continue;
            }
            var label = line_display_label(line);
            var shape_class = label.length > 2 ? 'subway-line-long' : 'subway-line';
            var diamond_class = line.diamond ? ' line-diamond' : '';
            var item = $('<div class="subway-clickable"></div>');
            item.addClass(shape_class + ' subway-clickable' + diamond_class);
            item.attr('data-line-id', line.id);
            item.attr('id', 'line-option-' + line.id);
            item.attr('title', line.name);
            item.css({backgroundColor: line.color_bg, color: line.color_text});
            if (N_active_line && N_active_line.id == line.id) {
                item.addClass('subway-selected');
            }
            if (shape_class == 'subway-line') {
                item.append('<div class="height_fix"></div>');
            }
            item.append($('<div class="content"></div>').text(label));
            group.append(item);
        }
        if (group.children().length > 0) {
            selector.append(group);
        }
    }
}

function line_has_variant(line_id, kind) {
    for (var i = 0; i < N_lines.length; i++) {
        if (!N_lines[i].deleted && N_lines[i].variant_parent_id == line_id &&
            (N_lines[i].variant_kind == kind || (kind == 'branch' && N_lines[i].variant_kind == 'legacy-branch'))) {
            return true;
        }
    }
    return false;
}

function manager_line_swatch(line) {
    var label = line_display_label(line);
    var swatch = $('<span class="line-manager-swatch"></span>');
    if (label.length > 2) {
        swatch.addClass('is-long');
    }
    if (line.diamond) {
        swatch.addClass('is-diamond');
    }
    swatch.css({backgroundColor: line.color_bg, color: line.color_text});
    swatch.append($('<span class="line-manager-swatch-label"></span>').text(label));
    return swatch;
}

function line_manager_open(mode) {
    $('#line-manager-backdrop').addClass('is-open').attr('aria-hidden', 'false');
    if (mode == 'custom') {
        line_manager_show_custom_form();
        $('#line-manager-content').find('[name="custom-name"]').trigger('focus');
    } else {
        line_manager_show_picker(mode);
        $('#line-manager-content').find('.line-manager-choice:not(:disabled)').first().trigger('focus');
    }
}

function line_manager_close() {
    $('#line-manager-backdrop').removeClass('is-open').attr('aria-hidden', 'true');
}

function line_manager_show_picker(mode) {
    var titles = {
        custom: 'Add Custom Line',
        edit: 'Edit Existing Line',
        delete: 'Delete Line',
        branch: 'Create Branch Line',
        diamond: 'Create Express Line'
    };
    $('#line-manager-title').text(titles[mode]);
    var content = $('#line-manager-content').empty();
    var picker = $('<div class="line-manager-picker"></div>');
    var lines = N_lines.filter(function(line) {
        if (line.deleted || line.name == 'N/A') {
            return false;
        }
        if (mode == 'edit') {
            return line.variant_parent_id == null && !line.branch &&
                line.variant_kind != 'branch' && line.variant_kind != 'legacy-branch' && line.variant_kind != 'diamond';
        }
        return true;
    });

    if (lines.length == 0) {
        content.append($('<p></p>').text('There are no active subway lines.'));
        return;
    }

    lines.forEach(function(line) {
        var choice = $('<button type="button" class="line-manager-choice"></button>');
        choice.attr('data-line-id', line.id);
        choice.append(manager_line_swatch(line));
        choice.append($('<span class="line-manager-choice-name"></span>').text(line.name));
        var express_name_conflict = mode == 'diamond' &&
            line_manager_internal_name_in_use(line.name + '-Express', line_manager_family_ids(line));
        if ((mode == 'branch' || mode == 'diamond') && (
            line.variant_parent_id != null ||
            (mode == 'branch' && line_has_variant(line.id, 'branch')) ||
            (mode == 'diamond' && (line_has_variant(line.id, 'diamond') || express_name_conflict)))) {
            var variant_name = mode == 'diamond' ? 'express' : mode;
            var variant_article = mode == 'diamond' ? 'an' : 'a';
            var disabled_reason = express_name_conflict ? 'An active line already uses the internal Express name.' :
                (line.variant_parent_id != null ? 'Create variants from an original line.' : 'This line already has ' + variant_article + ' ' + variant_name + ' variant.');
            choice.prop('disabled', true).attr('title', disabled_reason);
        }
        picker.append(choice);
    });

    content.append(picker);
    content.off('click.lineManager').on('click.lineManager', '.line-manager-choice:not(:disabled)', function() {
        var line = N_lines[parseInt($(this).attr('data-line-id'), 10)];
        if (!line || line.deleted) {
            return;
        }
        if (mode == 'edit') {
            line_manager_show_edit_form(line);
        } else if (mode == 'delete') {
            line_manager_confirm_delete(line);
        } else if (mode == 'branch') {
            line_manager_show_branch_form(line);
        } else {
            create_diamond_line(line, line.name + '-Express');
            line_manager_close();
        }
    });
}

function line_manager_form_error(message) {
    $('#line-manager-error').text(message);
}

function line_manager_internal_name_in_use(name, ignored_ids) {
    var normalized = $.trim(String(name || '')).toLowerCase();
    return N_lines.some(function(line) {
        return !line.deleted &&
            (ignored_ids || []).indexOf(line.id) < 0 &&
            $.trim(String(line.name || '')).toLowerCase() == normalized;
    });
}

function line_manager_family_ids(line) {
    return [line.id].concat(N_lines.filter(function(candidate) {
        return !candidate.deleted && candidate.variant_parent_id == line.id;
    }).map(function(candidate) { return candidate.id; }));
}

function line_manager_edited_family_names(line, internal_name) {
    var children = N_lines.filter(function(candidate) {
        return !candidate.deleted && candidate.variant_parent_id == line.id;
    });
    var parent_internal_name = line.route_suffix ? internal_name + '-' + line.route_suffix : internal_name;
    var names = [parent_internal_name];
    children.forEach(function(child) {
        if (child.variant_kind == 'branch' || child.variant_kind == 'legacy-branch') {
            var suffix = child.variant_suffix || split_route_name(child.name).suffix;
            if (suffix) {
                names.push(internal_name + '-' + suffix);
            }
        } else if (child.variant_kind == 'diamond') {
            names.push(parent_internal_name + '-Express');
        }
    });
    return names;
}

function normalize_line_hex_color(value) {
    var color = $.trim(String(value || '')).replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(color)) {
        color = color.split('').map(function(character) { return character + character; }).join('');
    }
    return /^[0-9a-f]{6}$/i.test(color) ? '#' + color.toUpperCase() : null;
}

function line_manager_show_color_picker(form, field, line_color_property) {
    var content = $('#line-manager-content');
    form.detach();
    content.off('click.lineManager');
    content.empty();
    var original_title = form.data('line-manager-title');
    $('#line-manager-title').text('Pick based on existing line');
    var back = $('<button type="button" class="line-manager-color-back">Back to line settings</button>');
    var picker = $('<div class="line-manager-picker"></div>');

    N_lines.filter(function(line) {
        return !line.deleted && line.name != 'N/A';
    }).forEach(function(line) {
        var choice = $('<button type="button" class="line-manager-choice"></button>');
        choice.append(manager_line_swatch(line));
        choice.append($('<span class="line-manager-choice-name"></span>').text(line.name));
        choice.on('click', function() {
            field.setValue(line_color_property == 'color_text' ? line.color_text : line.color_bg);
            content.empty().append(form);
            $('#line-manager-title').text(original_title);
        });
        picker.append(choice);
    });

    back.on('click', function() {
        content.empty().append(form);
        $('#line-manager-title').text(original_title);
    });
    content.append(back, picker);
}

function line_manager_color_field(form, name, label, initial_value, line_color_property, on_change) {
    var field = $('<div class="line-manager-color-field"></div>');
    field.append($('<label></label>').text(label));
    var hex_input = $('<input type="text" class="line-manager-color-hex" maxlength="7" autocomplete="off" spellcheck="false" required>').attr('name', name).attr('aria-label', label + ' hex code').attr('placeholder', '#RRGGBB');
    var native_picker = $('<input type="color" class="line-manager-native-color-input" tabindex="-1" aria-hidden="true">');
    var swatch = $('<span class="line-manager-color-preview" aria-hidden="true"></span>');
    var native_button = $('<button type="button" class="line-manager-color-action">Internal Color Picker</button>');
    var existing_button = $('<button type="button" class="line-manager-color-action">Pick based on existing line</button>');
    var controls = $('<div class="line-manager-color-controls"></div>');
    var actions = $('<div class="line-manager-color-actions"></div>');
    controls.append(swatch, hex_input, native_picker);
    actions.append(native_button, existing_button);
    field.append(controls, actions);

    function set_value(value, notify) {
        var normalized = normalize_line_hex_color(value);
        if (!normalized) {
            return false;
        }
        hex_input.val(normalized).removeClass('is-invalid').removeAttr('aria-invalid');
        native_picker.val(normalized);
        swatch.css('background-color', normalized);
        if (notify && on_change) {
            on_change(normalized);
        }
        return true;
    }

    native_button.on('click', function() {
        native_picker[0].click();
    });
    native_picker.on('input change', function() {
        set_value(native_picker.val(), true);
    });
    hex_input.on('input change', function() {
        var normalized = normalize_line_hex_color(hex_input.val());
        if (normalized) {
            set_value(normalized, true);
        } else {
            hex_input.addClass('is-invalid').attr('aria-invalid', 'true');
        }
    });
    existing_button.on('click', function() {
        line_manager_show_color_picker(form, {setValue: function(value) { set_value(value, true); }}, line_color_property);
    });

    set_value(initial_value, false);
    return {
        element: field,
        input: hex_input,
        getValue: function() { return normalize_line_hex_color(hex_input.val()); },
        setValue: function(value) { return set_value(value, true); }
    };
}

function line_manager_show_custom_form() {
    $('#line-manager-title').text('Add Custom Line');
    var content = $('#line-manager-content').empty();
    var form = $('<form class="line-manager-form line-manager-custom-form"></form>');
    var preview = $('<div class="line-manager-custom-preview"><span class="line-manager-preview-label">Preview</span><div class="line-manager-preview-stage"></div></div>');
    var internal_name = $('<input name="custom-name" type="text" maxlength="60" placeholder="e.g. Crosstown" required>');
    var display_name = $('<input name="display-name" type="text" maxlength="60" placeholder="Uses the internal name if blank">');
    var actions = $('<div class="line-manager-actions"><button type="button" class="line-manager-cancel">Cancel</button><button type="submit">Add line</button></div>');
    form.data('line-manager-title', 'Add Custom Line');
    var background;
    var text;

    form.append(preview);
    var internal_section = $('<fieldset class="line-manager-name-section"><legend>Internal Names</legend></fieldset>');
    internal_section.append($('<label>Unique internal name</label>').append(internal_name));
    internal_section.append('<p class="line-manager-field-help">Must be unique. Branch and Express routes add their own suffix.</p>');
    var display_section = $('<fieldset class="line-manager-name-section"><legend>Display Name</legend></fieldset>');
    display_section.append($('<label>Displayed badge name</label>').append(display_name));
    display_section.append('<p class="line-manager-field-help">This text appears on the map and may be shared by other routes.</p>');
    form.append(internal_section, display_section);
    background = line_manager_color_field(form, 'custom-color', 'Line color', '#808183', 'color_bg', update_preview);
    text = line_manager_color_field(form, 'custom-text', 'Text color', '#FFFFFF', 'color_text', update_preview);
    form.append(background.element, text.element);
    form.append('<div class="line-manager-error" id="line-manager-error"></div>');
    form.append(actions);
    content.append(form);

    function update_preview() {
        var label = $.trim(display_name.val()) || $.trim(internal_name.val()) || '?';
        var is_long = label.length > 2;
        var marker = $('<span class="custom-line-marker-preview"></span>').toggleClass('is-long', is_long).text(label);
        marker.css({backgroundColor: background.getValue() || '#808183', color: text.getValue() || '#FFFFFF'});
        preview.find('.line-manager-preview-stage').empty().append(marker);
    }

    internal_name.add(display_name).on('input', update_preview);
    update_preview();

    form.on('click', '.line-manager-cancel', line_manager_close);
    form.on('submit', function(event) {
        event.preventDefault();
        var line_name = $.trim(internal_name.val());
        var badge_name = $.trim(display_name.val()) || line_name;
        if (!line_name) {
            line_manager_form_error('Enter a unique internal name.');
            internal_name.trigger('focus');
            return;
        }
        if (line_name.toLowerCase() == 'n/a') {
            line_manager_form_error('That internal name is reserved.');
            internal_name.trigger('focus');
            return;
        }
        if (!background.getValue() || !text.getValue()) {
            line_manager_form_error('Enter valid 3- or 6-digit hex colors for both color fields.');
            (background.getValue() ? text.input : background.input).trigger('focus');
            return;
        }
        if (line_manager_internal_name_in_use(line_name)) {
            line_manager_form_error('That internal name is already in use.');
            internal_name.trigger('focus');
            return;
        }
        var line_class = badge_name.length > 2 ? 'subway-line-long' : 'subway-line';
        add_custom_line(line_name, badge_name, line_class, background.getValue(), text.getValue());
        line_manager_close();
    });
}

function line_manager_action_buttons(back_label) {
    var actions = $('<div class="line-manager-actions"></div>');
    var back = $('<button type="button" class="line-manager-back"></button>').text(back_label || 'Choose another line');
    var save = $('<button type="submit"></button>').text('Save');
    actions.append(back, save);
    return actions;
}

function line_manager_show_edit_form(line) {
    $('#line-manager-title').text('Edit ' + line.name);
    var content = $('#line-manager-content').empty();
    var form = $('<form class="line-manager-form"></form>');
    form.data('line-manager-title', 'Edit ' + line.name);
    var internal_name = $('<input name="line-name" type="text" maxlength="60" required>');
    var display_name = $('<input name="display-name" type="text" maxlength="60">');
    var internal_section = $('<fieldset class="line-manager-name-section"><legend>Internal Names</legend></fieldset>');
    internal_section.append($('<label>Unique internal name</label>').append(internal_name));
    internal_section.append('<p class="line-manager-field-help">Must be unique. Branch and Express routes add their own suffix.</p>');
    var display_section = $('<fieldset class="line-manager-name-section"><legend>Display Name</legend></fieldset>');
    display_section.append($('<label>Displayed badge name</label>').append(display_name));
    display_section.append('<p class="line-manager-field-help">Other routes can use the same badge name.</p>');
    form.append(internal_section, display_section);
    var background;
    var text;
    background = line_manager_color_field(form, 'line-color', 'Line color', line.color_bg, 'color_bg');
    text = line_manager_color_field(form, 'text-color', 'Text color', line.color_text, 'color_text');
    form.append(background.element, text.element);
    form.append('<div class="line-manager-error" id="line-manager-error"></div>');
    form.append(line_manager_action_buttons('Back to lines'));
    content.append(form);
    internal_name.val(line.route_base_name || internal_route_base(line.name, line.route_suffix));
    display_name.val(display_route_base(line_display_label(line), line.route_suffix));
    form.on('click', '.line-manager-back', function() {
        line_manager_show_picker('edit');
    });
    form.on('submit', function(event) {
        event.preventDefault();
        var name = $.trim(internal_name.val());
        var badge_name = $.trim(display_name.val()) || name;
        var color = background.getValue();
        var textColor = text.getValue();
        if (!name) {
            line_manager_form_error('Enter a unique internal name.');
            internal_name.trigger('focus');
            return;
        }
        if (name.toLowerCase() == 'n/a') {
            line_manager_form_error('That internal name is reserved.');
            internal_name.trigger('focus');
            return;
        }
        if (!color || !textColor) {
            line_manager_form_error('Enter valid 3- or 6-digit hex colors for both color fields.');
            (!color ? background.input : text.input).trigger('focus');
            return;
        }
        var ignored_ids = line_manager_family_ids(line);
        var proposed_names = line_manager_edited_family_names(line, name);
        var duplicate_name = proposed_names.find(function(proposed_name) {
            return line_manager_internal_name_in_use(proposed_name, ignored_ids);
        });
        if (duplicate_name) {
            line_manager_form_error('The internal name "' + duplicate_name + '" is already in use.');
            internal_name.trigger('focus');
            return;
        }
        update_line_family(line, name, badge_name, color, textColor);
        line_manager_close();
    });
}

function line_manager_show_branch_form(line) {
    $('#line-manager-title').text('Create a branch from ' + line.name);
    var content = $('#line-manager-content').empty();
    var form = $('<form class="line-manager-form"></form>');
    var prefix = line.route_base_name || line.name;
    var existing_row = $('<label>Existing route name</label><div class="line-manager-name-row"><span class="line-manager-prefix"></span><input name="existing-suffix" type="text" maxlength="40" required></div>');
    var branch_row = $('<label>Branch route name</label><div class="line-manager-name-row"><span class="line-manager-prefix"></span><input name="branch-suffix" type="text" maxlength="40" required></div>');
    existing_row.find('.line-manager-prefix').text(prefix + '-');
    branch_row.find('.line-manager-prefix').text(prefix + '-');
    form.append(existing_row, branch_row);
    form.append('<p>Both routes will keep this line’s color and begin with its current stations. You can edit their stations separately on the map.</p>');
    form.append('<div class="line-manager-error" id="line-manager-error"></div>');
    form.append(line_manager_action_buttons('Back to lines'));
    content.append(form);
    form.find('[name="existing-suffix"]').val(line.route_suffix || '');
    form.on('click', '.line-manager-back', function() {
        line_manager_show_picker('branch');
    });
    form.on('submit', function(event) {
        event.preventDefault();
        var existingSuffix = $.trim(form.find('[name="existing-suffix"]').val());
        var branchSuffix = $.trim(form.find('[name="branch-suffix"]').val());
        if (!existingSuffix || !branchSuffix) {
            line_manager_form_error('Enter a name for both routes.');
            return;
        }
        if (existingSuffix.toLowerCase() == branchSuffix.toLowerCase()) {
            line_manager_form_error('Choose different names for the two routes.');
            return;
        }
        var proposed_names = [prefix + '-' + existingSuffix, prefix + '-' + branchSuffix];
        var family_ids = line_manager_family_ids(line);
        var conflicting_name = proposed_names.find(function(name) {
            return line_manager_internal_name_in_use(name, family_ids);
        });
        if (conflicting_name) {
            line_manager_form_error('The internal name "' + conflicting_name + '" is already in use.');
            return;
        }
        create_branch_line(line, prefix, existingSuffix, branchSuffix);
        line_manager_close();
    });
}

function line_manager_confirm_delete(line) {
    var children = N_lines.filter(function(candidate) {
        return !candidate.deleted && candidate.variant_parent_id == line.id;
    });
    var is_variant = line.variant_parent_id != null;
    var prompt_text = 'Are you sure you want to delete the ' + line.name + ' line?';
    if (!is_variant && children.length > 0) {
        prompt_text += ' Its ' + children.map(function(child) { return child.name; }).join(' and ') + ' line will also be deleted.';
    }
    if (window.confirm(prompt_text)) {
        delete_subway_line(line);
        line_manager_close();
    }
}

function compose_route_name(base, suffix) {
    return suffix ? base + ' - ' + suffix : base;
}

function display_route_base(display_name, route_suffix) {
    var base_name = $.trim(String(display_name || ''));
    if (!route_suffix) {
        return base_name;
    }
    var tails = [' - ' + route_suffix, '-' + route_suffix];
    for (var i = 0; i < tails.length; i++) {
        if (base_name.toLowerCase().slice(-tails[i].length) == tails[i].toLowerCase()) {
            return $.trim(base_name.slice(0, -tails[i].length));
        }
    }
    return base_name;
}

function split_route_name(name) {
    var divider = name.indexOf(' - ');
    if (divider > 0) {
        return {base: $.trim(name.substring(0, divider)), suffix: $.trim(name.substring(divider + 3))};
    }
    return {base: name, suffix: ''};
}

function set_line_label(line, internal_name, display_name) {
    line.name = internal_name;
    line.html = display_name;
    line.css = display_name.length > 2 ? 'subway-line-long' : 'subway-line';
}

function internal_route_base(internal_name, route_suffix) {
    var base_name = $.trim(internal_name);
    if (!route_suffix) {
        return base_name;
    }
    var tails = ['-' + route_suffix, ' - ' + route_suffix];
    for (var i = 0; i < tails.length; i++) {
        if (base_name.toLowerCase().slice(-tails[i].length) == tails[i].toLowerCase()) {
            return base_name.slice(0, -tails[i].length);
        }
    }
    return base_name;
}

function update_line_family(line, internal_name, display_name, color, textColor) {
    var parent = line.variant_parent_id == null ? line : N_lines[line.variant_parent_id];
    if (!parent) {
        return;
    }
    var variant_children = N_lines.filter(function(candidate) {
        return !candidate.deleted && candidate.variant_parent_id == parent.id;
    });
    var route_base = internal_name;
    var parent_internal_name = parent.route_suffix ? route_base + '-' + parent.route_suffix : internal_name;
    var display_label = $.trim(display_name) || internal_name;

    var parent_display_label = compose_route_name(display_label, parent.route_suffix);
    set_line_label(parent, parent_internal_name, parent_display_label);
    if (parent.route_suffix || variant_children.some(function(candidate) {
        return candidate.variant_kind == 'branch' || candidate.variant_kind == 'legacy-branch';
    })) {
        parent.route_base_name = route_base;
    }

    variant_children.forEach(function(candidate) {
        if (candidate.variant_kind == 'branch' || candidate.variant_kind == 'legacy-branch') {
            var suffix = candidate.variant_suffix || split_route_name(candidate.name).suffix;
            if (suffix) {
                set_line_label(candidate, route_base + '-' + suffix, compose_route_name(display_label, suffix));
                candidate.route_base_name = route_base;
                candidate.route_suffix = suffix;
                candidate.variant_suffix = suffix;
            }
        } else if (candidate.variant_kind == 'diamond') {
            set_line_label(candidate, parent_internal_name + '-Express', parent_display_label);
        }
        candidate.color_bg = color;
        candidate.color_text = textColor;
    });

    parent.color_bg = color;
    parent.color_text = textColor;
    refresh_line_network();
}

function create_branch_line(line, base, existingSuffix, branchSuffix) {
    var display_base = display_route_base(line_display_label(line), line.route_suffix);
    line.route_base_name = base;
    line.route_suffix = existingSuffix;
    set_line_label(line, base + '-' + existingSuffix, compose_route_name(display_base, existingSuffix));
    var branch_internal_name = base + '-' + branchSuffix;
    var branch_display_name = compose_route_name(display_base, branchSuffix);
    var branch_css = branch_display_name.length > 2 ? 'subway-line-long' : 'subway-line';
    var branch = new Line(branch_internal_name, branch_display_name, branch_css, line.color_bg, line.color_text);
    branch.variant_parent_id = line.id;
    branch.variant_kind = 'branch';
    branch.variant_suffix = branchSuffix;
    branch.route_base_name = base;
    branch.route_suffix = branchSuffix;
    branch.stations = line.stations.slice(0);
    branch.stations.forEach(function(station_id) {
        var station = N_stations[station_id];
        if (station && station.active && !is_in_array(branch.id, station.lines)) {
            station.lines.push(branch.id);
        }
    });
    N_lines.push(branch);
    N_active_line = branch;
    refresh_line_network();
}

function create_diamond_line(line, name) {
    var diamond = new Line(name, line.html, line.css, line.color_bg, line.color_text);
    diamond.variant_parent_id = line.id;
    diamond.variant_kind = 'diamond';
    diamond.diamond = true;
    diamond.stations = line.stations.slice(0);
    diamond.stations.forEach(function(station_id) {
        var station = N_stations[station_id];
        if (station && station.active && !is_in_array(diamond.id, station.lines)) {
            station.lines.push(diamond.id);
        }
    });
    N_lines.push(diamond);
    N_active_line = diamond;
    refresh_line_network();
}

function delete_subway_line(line) {
    var target_lines = [line];
    if (line.variant_parent_id == null) {
        target_lines = target_lines.concat(N_lines.filter(function(candidate) {
            return !candidate.deleted && candidate.variant_parent_id == line.id;
        }));
    }
    var target_ids = target_lines.map(function(candidate) { return candidate.id; });
    var affected = [];

    target_lines.forEach(function(target) {
        target.stations.slice(0).forEach(function(station_id) {
            var station = N_stations[station_id];
            if (!station || !station.active) {
                return;
            }
            station.drawmaps().forEach(function(line_id) {
                if (!is_in_array(line_id, affected)) {
                    affected.push(line_id);
                }
            });
            station.lines.forEach(function(line_id) {
                var shared_line = N_lines[line_id];
                if (!shared_line || target_ids.indexOf(line_id) >= 0) {
                    return;
                }
                if (!is_in_array(line_id, affected)) {
                    affected.push(line_id);
                }
                var position = shared_line.stations.indexOf(station_id);
                if (position > -1) {
                    var start = Math.max(0, position - SHARED_STRETCH_THRESHOLD);
                    var end = Math.min(shared_line.stations.length, position + SHARED_STRETCH_THRESHOLD + 1);
                    for (var i = start; i < end; i++) {
                        var nearby = N_stations[shared_line.stations[i]];
                        if (nearby && nearby.active) {
                            nearby.drawmaps().forEach(function(nearby_line_id) {
                                if (!is_in_array(nearby_line_id, affected)) {
                                    affected.push(nearby_line_id);
                                }
                            });
                        }
                    }
                }
            });
        });
    });

    target_lines.forEach(function(target) {
        target.stations.slice(0).forEach(function(station_id) {
            var station = N_stations[station_id];
            if (!station || !station.active) {
                return;
            }
            var membership = station.lines.indexOf(target.id);
            if (membership > -1) {
                station.lines.splice(membership, 1);
            }
            if (station.lines.length == 0) {
                station.del();
            }
        });
        target.deleted = true;
        target.stations = [];
        target.draw_map = [];
        target.control_points = [];
    });

    if (N_active_line && target_ids.indexOf(N_active_line.id) > -1) {
        N_active_line = line.variant_parent_id != null ? N_lines[line.variant_parent_id] : null;
        if (!N_active_line || N_active_line.deleted) {
            N_active_line = N_lines.find(function(candidate) { return !candidate.deleted && candidate.name != 'N/A'; }) || null;
        }
    }
    refresh_line_network(affected);
}

function refresh_line_network(impacted_lines) {
    rebuild_line_groups();
    N_lines.forEach(function(line) {
        if (line.deleted) {
            line.draw();
        } else if (line.name != 'N/A') {
            line.generate_draw_map();
            line.generate_control_points();
        }
    });
    N_lines.forEach(function(line) {
        if (!line.deleted && line.name != 'N/A') {
            line.draw();
        }
    });
    N_stations.forEach(function(station) {
        if (station && station.active) {
            station.set_marker_style();
        }
    });
    if (typeof station_layer != 'undefined') {
        station_layer.bringToFront();
    }
    if (typeof regenerate_popups == 'function') {
        regenerate_popups();
    }
    render_line_selectors();
    generate_route_diagram(N_active_line);
    calculate_total_ridership();
}

$(function() {
    $('#custom-line').on('click', function() { line_manager_open('custom'); });
    $('#edit-existing-line').on('click', function() { line_manager_open('edit'); });
    $('#delete-existing-line').on('click', function() { line_manager_open('delete'); });
    $('#create-branch-line').on('click', function() { line_manager_open('branch'); });
    $('#add-diamond-line').on('click', function() { line_manager_open('diamond'); });
    $('#line-manager-close').on('click', line_manager_close);
    $('#line-manager-backdrop').on('click', function(event) {
        if (event.target === this) {
            line_manager_close();
        }
    });
    $(document).on('keydown.lineManager', function(event) {
        if (event.key === 'Escape') {
            line_manager_close();
        }
    });
});
