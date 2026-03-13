function doGet(e) {
  initSheets();

  const action = (e && e.parameter && e.parameter.action) || '';
  const params = (e && e.parameter) || {};

  switch (action) {
    case 'getCatalog':
      return jsonOutput(getCatalog());
    case 'getAdminDashboard':
      return jsonOutput(getAdminDashboard());
    case 'getEventDetail':
      return jsonOutput(getEventDetail(params.eventId));
    case 'getEvents':
      return jsonOutput(getEvents());
    case 'getSchedules':
      return jsonOutput(getSchedules(params.eventId));
    case 'getReservations':
      return jsonOutput(getReservations(params.eventId));
    case 'getSettings':
      return jsonOutput(getSettings());
    default:
      return jsonOutput(errorResponse('Unknown action'));
  }
}

function doPost(e) {
  initSheets();

  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return jsonOutput(errorResponse('Invalid JSON'));
  }

  const action = body.action;
  const data = body.data || {};

  switch (action) {
    case 'addReservation':
      return jsonOutput(addReservationService(data));
    case 'saveEvent':
      return jsonOutput(saveEventService(data));
    case 'deleteEvent':
      return jsonOutput(deleteEventService(data.id));
    case 'addSchedule':
      return jsonOutput(addScheduleService(data));
    case 'deleteSchedule':
      return jsonOutput(deleteScheduleService(data));
    case 'changePassword':
      return jsonOutput(changePasswordService(data));
    case 'adminLogin':
      return jsonOutput(adminLoginService(data));
    default:
      return jsonOutput(errorResponse('Unknown action'));
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('스포츠박스').addItem('시트 초기화', 'initSheets').addToUi();
}
