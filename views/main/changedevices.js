var $table = $('#table-userdevices');

$(function () {
    if (userdevices !== null) {
        $table.bootstrapTable({});
        $table.bootstrapTable('load', userdevices.userdevices);
        updateForm($table.bootstrapTable('getData')[0]);

        $table.on('click-row.bs.table', function (e, row, $element) {
            $('.success').removeClass('success');
            $($element).addClass('success');
            var index = $table.find('tr.success').data('index');
            updateForm($table.bootstrapTable('getData')[index]);
        });
    }

    $('#btnSave').click(function () {
        var fixed_loc_lon = $('input[name=fixed_loc_lon]').val();
        var fixed_loc_lat = $('input[name=fixed_loc_lat]').val();
        var fixedloc = $('#fixedloc').prop('checked');
        if (!fixedloc || fixed_loc_lon === null || fixed_loc_lat === null) {
            $('input[name=fixed_loc_lon]').val('');
            $('input[name=fixed_loc_lat]').val('');
        }
        $('input[name="action"]').val('submit');
        $('#frmdetails').submit();
    });

    $('#btnCancel').click(function () {
        $('input[name="action"]').val('cancel');
        $('#frmdetails').submit();
    });

    $('#fixedloc').click(function () {
        if ($('#fixedloc').prop('checked')) {
            $('input[name=fixed_loc_lon]').prop('readonly', false);
            $('input[name=fixed_loc_lat]').prop('readonly', false);
            // Show placeholder
            if ($('input[name=fixed_loc_lon]').val() === ' ') {
                $('input[name=fixed_loc_lon]').val('');
            }
            if ($('input[name=fixed_loc_lat]').val() === ' ') {
                $('input[name=fixed_loc_lat]').val('');
            }
        } else {
            $('input[name=fixed_loc_lon]').prop('readonly', true);
            $('input[name=fixed_loc_lat]').prop('readonly', true);
            // Hide placeholder
            if ($('input[name=fixed_loc_lon]').val() === '') {
                $('input[name=fixed_loc_lon]').val(' ');
            }
            if ($('input[name=fixed_loc_lat]').val() === '') {
                $('input[name=fixed_loc_lat]').val(' ');
            }
        }
    });

    $('#btnAddUser').click(function () {
        var checkedDevices, sharedUser, i, checkedIds;

        checkedDevices = $('#table-userdevices').bootstrapTable('getAllSelections');
        sharedUser = $('input[name="shareduser"]').val();
        i = 0;
        checkedIds = [];
        while (i < checkedDevices.length) {
            checkedIds[i] = checkedDevices[i].device_id;
            i++;
        }
        $.post("/addusertodevices", {sharedUser, checkedIds}, function(data,status) {
        //    alert("Data: " + data + "\nStatus: " + status);
        });
    });

    $('#btnRemoveUser').click(function () {
        alert('Removal of users not possible yet');
    });
});

function updateForm(devicedata) {
    $('input[name=device_id]').val(devicedata.device_id);
    $('input[name=identifier]').val(devicedata.identifier);
    $('input[name=alias]').val(devicedata.alias);
    if (devicedata.fixed_loc_lon === null || devicedata.fixed_loc_lat === null) {
        $('input[name=fixed_loc_lon]').val(' ');
        $('input[name=fixed_loc_lat]').val(' ');
        $('input[name=fixed_loc_lon]').prop('readonly', true);
        $('input[name=fixed_loc_lat]').prop('readonly', true);
        $('#fixedloc').prop('checked', false);
    } else {
        $('input[name=fixed_loc_lon]').val(devicedata.fixed_loc_lon);
        $('input[name=fixed_loc_lat]').val(devicedata.fixed_loc_lat);
        $('input[name=fixed_loc_lon]').prop('readonly', false);
        $('input[name=fixed_loc_lat]').prop('readonly', false);
        $('#fixedloc').prop('checked', true);
    }
}

function shareFormatter(value) {
    if (parseInt(value) > 0) {
        return '<i class="glyphicon glyphicon-user"></i> ' + value;
    } else {
        return '';
    }
}