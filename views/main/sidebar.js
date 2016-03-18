// Convert UTC time to local time (local time zone and DST)
function dateTimeFormatter(value) {
    return new Date(value).toLocaleString();
}

$(function () {
    // Initialize table
    $('#table-locations').bootstrapTable({
//        striped: true,
//        pagination: true,
//        pageSize: 5,
//        pageList: [10, 25, 50, 100, 200],
//        search: false,
//        showHeader: false,
//        showColumns: false,
//        showRefresh: false,
//        minimumCountColumns: 2,
//        clickToSelect: true,
//        idField: 'device_id',
//        columns: [{
//            field: 'state',
//            checkbox: true
//        }, {
//            field: 'alias',
//            title: 'Device',
//            align: 'left',
//            valign: 'middle',
//            sortable: true
//        }, {
//            field: 'loc_timestamp',
//            title: 'Date/time stamp',
//            align: 'right',
//            valign: 'middle',
//            sortable: true,
//            formatter: dateTimeFormatter
//        }]
    });

    $('#table-locations').bootstrapTable('hideLoading');
});
