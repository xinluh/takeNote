$(document).ready(function() {
  $('#video-container').hide()

  var source = null;
  $('#gobtn').click(function() {
	  $('#video-container').show();
	  location.href = "#video";
	  $("#video-title").html("Loading video...");

      source = new EventSource('/getImageStream/'+encodeURIComponent($("#videoUrl").val()));
	  source.addEventListener('onstart', eventsource_onstart, false);
	  source.addEventListener('onprogress', eventsource_onprogress, false);
	  source.addEventListener('onend', eventsource_onend, false);
	  source.onmessage = eventsource_onmessage;
	  // $.post('getimages', {'url': $("#videoUrl").val()},
			 // function(data) {
				 // console.log(data);
				 
			 // });
	  
  });
  $('#stopbtn').click(function() {
	  source.close();
  });

  var current_video_length = 0;
  // var source = new EventSource('/getImageStream');
  
  function sec_to_time_string(sec) {
	    var hour = Math.floor(sec/60/60);
	    var min  = Math.floor(sec/60%60)
	    var second = Math.floor(sec%60);
	    return (hour < 10 ? "0"+ hour : hour)+ ":"+ (min < 10 ? "0" + min : min) + ":" + (second < 10 ? "0" + second : second)
  }

  var eventsource_onmessage = function (event) {
	    // console.log(event.data);
	    var data = JSON.parse(event.data);
	    // console.log(data.sec);
	    var img = "data:image/png;base64,"+data.img;
	    var frame = "data:image/png;base64,"+data.frame;
        // $('#col1').append(`<img style="padding:10px" src="${img}" title="${title}"/>`)
	    $('#current-img').attr('src', img).attr('title', data.proba)
	    $('#current-frame').attr('src', frame).attr('title', data.proba)

	    $('#current-img-time').html(' at ' + sec_to_time_string(data.sec))

	    var ctx = $('#canvas').get(0).getContext("2d");
	    var image = new Image();
	    image.onload = function() {
	   	  ctx.drawImage(image,data.left_corner[1],data.left_corner[0]);
	    };
	    image.src = img
	    $('#canvas-hightlight').css('width',data.size[1]+'px')
	    $('#canvas-hightlight').css('height', data.size[0]+"px")
	    $('#canvas-hightlight').css('margin-left', data.left_corner[1]+"px")
	    $('#canvas-hightlight').css('margin-top', data.left_corner[0]+"px")
	    $('#canvas-hightlight').css('visibility', 'visible')


  };
	var eventsource_onstart = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		console.log(e.data)
		var data = JSON.parse(e.data)
		current_video_length = data.video_length
		console.log(current_video_length)
		$("#video-title").html(data.video_title);
		$("#video-desc").html(data.video_desc);
		$("#video-author").html(data.video_author);

		var canvas = $("#canvas").get(0);
		canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
		$('#current-img').removeAttr('src').attr('title', data.proba)
	    $('#current-frame').removeAttr('src').attr('title', data.proba)

	};
	var eventsource_onprogress = function(e) {
		$('#progressbar').show();
		var data = JSON.parse(e.data)
		//console.log('onprogress');
		// console.log(sec_to_time_string(current_video_length));
	    if (current_video_length > 0) {
			var percentage = (data.sec/current_video_length*100).toFixed(1)+"%";
			$('#progressbar').attr('style', "width:"+percentage).html("Processing " + sec_to_time_string(data.sec) +"/"+ sec_to_time_string(current_video_length));
		}
	};
	var eventsource_onend = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		console.log('onend')
		console.log(e.data)
		event.target.close();
	};

})