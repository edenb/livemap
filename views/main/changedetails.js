var $table = $('#table-allusers');

$(function () {
    $table.bootstrapTable({});
    $table.bootstrapTable('load', usersData.users);

    $table.on('click-row.bs.table', function (e, row, $element) {
        $('.success').removeClass('success');
        $($element).addClass('success');
        var index = $table.find('tr.success').data('index');
        updateForm($table.bootstrapTable('getData')[index]);
    });

    $('#btnNewUser').click(function () {
        clearForm();
    });
});

function updateForm(userdata) {
    $('input[name=user_id]').val(userdata.user_id);
    $('input[name=username]').val(userdata.username);
    $('input[name=fullname]').val(userdata.fullname);
    $('input[name=email]').val(userdata.email);
    $('input[name=api_key]').val(userdata.api_key);
    $('select[name=role]').val(userdata.role);
}

function clearForm() {
    var newUser = {user_id:'0', username:'', fullname:'', email:'', api_key:'', role:''};
    updateForm(newUser);
}