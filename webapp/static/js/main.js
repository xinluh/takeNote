$(document).ready(function() {
  $('#video-container').hide()

  var source = null;
  $('#gobtn').click(function() {
	  $('#video-container').show();
	  location.href = "#video-container";
	  $("#video-title").html("Loading video...");

      source = new EventSource('/getImageStream/'+encodeURIComponent($("#videoUrl").val()));
	  source.addEventListener('onstart', eventsource_onstart, false);
	  source.addEventListener('onprogress', eventsource_onprogress, false);
	  source.addEventListener('onend', eventsource_onend, false);
	  source.addEventListener('onerasure', eventsource_onerasure, false);
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
  
  function sec_to_time_string(sec) {
	    var hour = Math.floor(sec/60/60);
	    var min  = Math.floor(sec/60%60)
	    var second = Math.floor(sec%60);
	    return (hour < 10 ? "0"+ hour : hour)+ ":"+ (min < 10 ? "0" + min : min) + ":" + (second < 10 ? "0" + second : second)
  }

  $('#blackboard').on('click', '.fragment', function() {
      alert('This goes to yt link at sec '+$(this).attr('data-framesec'));
  });
  $('#gallery').on('click', '.fragment', function() {
      alert('This goes to yt link at sec '+$(this).attr('data-framesec'));
  });
  $('#gallery').on('mouseenter mouseleave', '.fragment', function() {
	  var sec = $(this).attr('data-framesec');
	  $('#blackboard').find('[data-framesec="'+ sec + '"]').toggleClass('fragment-hover');
  });

  var eventsource_onmessage = function (event) {
	    // console.log(event.data);
	    var data = JSON.parse(event.data);
	    var img = "data:image/png;base64,"+data.img;
	    var frame = "data:image/png;base64,"+data.frame;
	    var title = data.sec + " " + data.proba;
	    var time = sec_to_time_string(data.sec);
        //$('#col1').append(`<img style="padding:10px" src="${img}" title="${title}"/>`)
	    if (data.size[1]*data.size[0] > 600) {
			var html = `<li class="span2 fragment"  data-framesec="${data.sec}" data-loc-x="${data.left_corner[1]}" data-loc-y="${data.left_corner[0]}"> <a class="thumbnail" ><img src="${img}" alt="" title="${data.proba} - ${data.n_sameblobs}"/></a><span class="time-text">${time}</span></li>`
			$(html).hide().appendTo('#gallery').fadeIn(2000);
		}

	    var html = `<div class="fragment" data-framesec="${data.sec}" style="width:${data.size[1]+'px'};height:${data.size[0]+'px'};margin-top:${data.left_corner[0]+'px'};margin-left:${data.left_corner[1]+'px'}"><img src="${img}" alt="" /><span>${time}</span></div>`
	    $(html).hide().appendTo('#blackboard').fadeIn(2000);

	    // $('#current-img').attr('src', img).attr('title', data.proba)
	    $('#current-frame').attr('src', frame).attr('title', data.proba)

	    // $('#current-img-time').html(' at ' + time)
	  
	    $('#blackboard-container').show()

	    // var ctx = $('#canvas').get(0).getContext("2d");
	    // var image = new Image();
	    // image.onload = function() {
	   	  // ctx.drawImage(image,data.left_corner[1],data.left_corner[0]);
	    // };
	    // image.src = img
	    // $('#canvas-hightlight').css('width',data.size[1]+'px')
	    // $('#canvas-hightlight').css('height', data.size[0]+"px")
	    // $('#canvas-hightlight').css('margin-left', data.left_corner[1]+"px")
	    // $('#canvas-hightlight').css('margin-top', data.left_corner[0]+"px")
	    // $('#canvas-hightlight').css('visibility', 'visible')


  };
	var eventsource_onerasure = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		// console.log(e.data)
		var data = JSON.parse(e.data)

		var blackboard_el = $('#blackboard').find('[data-framesec="'+ data.sec + '"]').filter(function() {
			return ($(this).css('margin-top') == data.left_corner[0]+'px' &&
					$(this).css('margin-left') == data.left_corner[1]+'px');
		});
		blackboard_el.attr('data-removedsec',data.removed_sec);
		blackboard_el.fadeOut(2000);

		var gallery_el = $('#gallery').find(`[data-framesec="${data.sec}"],[data-top-x="${data.left_corner[1]}"],[data-top-y="${data.left_corner[0]}"]`);
		gallery_el.attr('data-removedsec',data.removed_sec);
		var text_el = gallery_el.find(".time-text");
		text_el.text(text_el.text() + " - " + sec_to_time_string(data.removed_sec));
   };
	var eventsource_onstart = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		console.log(e.data)
		var data = JSON.parse(e.data)
		current_video_length = data.video_length
		$("#video-title").html(data.video_title);
		$("#video-author").html(data.video_author);
		$("#video-desc").html(data.video_desc);

		$("#blackboard .fragment").remove();
		$("#gallery .fragment").remove();
		$("#blackboard-container").hide()

		// var canvas = $("#canvas").get(0);
		// canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
		$('#current-img').removeAttr('src')
	    $('#current-frame').removeAttr('src')

	};
	var eventsource_onprogress = function(e) {
		$("#blackboard-container").show()
		$('#progressbar').show();
		var data = JSON.parse(e.data)
		//console.log('onprogress');
		// console.log(sec_to_time_string(current_video_length));
	    if (current_video_length > 0) {
			var percentage = (data.sec/current_video_length*100).toFixed(1)+"%";
			$('#progressbar').attr('style', "width:"+percentage)
			$('#progressbar .show').html("Processing " + sec_to_time_string(data.sec) +"/"+ sec_to_time_string(current_video_length));
		}
	};
	var eventsource_onend = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		console.log('onend')
		console.log(e.data)
		event.target.close();
		$('#progressbar .show').html('Done!')
		$('#progressbar').fadeOut(2000);
	};

})
