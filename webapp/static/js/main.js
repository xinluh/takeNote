$(document).ready(function() {
  $('#gobtn').click(function() {
	  $.post('getimages', {'url': $("#videoUrl").val()},
			 function(data) {
				 console.log(data);
				 
			 });
	  
  });

  var source = new EventSource('/getImageStream');
  source.onmessage = function (event) {
		//console.log(event.data);
        $('#col1').append('<img src="data:image/png;base64,'+event.data+'"/>')
//	    if (event.data > 5) {event.target.close();}
  };
})
