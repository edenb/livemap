var $table = $('#table-allusers');

$(function () {
    $table.bootstrapTable({});
    $table.bootstrapTable('load', usersData.users);
});
