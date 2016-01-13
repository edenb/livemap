var $table = $('#table-manageusers');

$(function () {
    $table.bootstrapTable({});
    $table.bootstrapTable('load', usersData.users);
});
