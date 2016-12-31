$(document).ready(function() {
  $('#video').hide()

  var source = null;
  $('#gobtn').click(function() {
	  // if (source != null) {source.close();}
	  $('#video').show();
	  $("#blackboard .fragment").remove();
	  $("#gallery .fragment").remove();
	  // $("#blackboard-container").hide()
	  

	  location.href = "#video";
	  $("#video-title").html("Loading video...");
	  $("#video-desc").html("")
	  $("#video-author").html("")
	  $("#gallery-placeholder").fadeIn(2000);
	  $('#blackboard-time span').text("00:00:00");
	  blackboard_paused = false;

	  $.get('/num_processes',function(data){
		  if (parseInt(data) > 3) {
			  $('#video').hide()
			  alert('Sorry too many people is accessing this at the same time. Try again later!')
			  return
		  }
          source = new EventSource('/getImageStream/'+encodeURIComponent($("#videoUrl").val()));
    	  source.addEventListener('onstart', eventsource_onstart, false);
    	  source.addEventListener('onprogress', eventsource_onprogress, false);
    	  source.addEventListener('onend', eventsource_onend, false);
    	  source.addEventListener('onerasure', eventsource_onerasure, false);
    	  source.addEventListener('onhist', eventsource_onhist, false);
    	  source.onmessage = eventsource_onmessage;
    	  source.onerror = function(e) {
    		console.log(e)
          };

	  })

	  if (chart == null) {nv.addGraph(nvd3_setup);}
  });
  $('#stopbtn').click(function() {
	  source.close();
  });

  var current_video_length = 0;
  var current_video_url = null;
  var current_blackboard_sec = 0;
  var blackboard_paused = false;
  var chart = null; // nvd3 chart
  var chartData;
  
  function sec_to_time_string(sec) {
	    var hour = Math.floor(sec/60/60);
	    var min  = Math.floor(sec/60%60)
	    var second = Math.floor(sec%60);
	    return (hour < 10 ? "0"+ hour : hour)+ ":"+ (min < 10 ? "0" + min : min) + ":" + (second < 10 ? "0" + second : second)
  }
  function make_yt_link(sec) {
	    var hour = Math.floor(sec/60/60);
	    var min  = Math.floor(sec/60%60)
	    var second = Math.floor(sec%60);
	    return current_video_url+`&t=${hour}h${min}m${second}s`
  }
  function rewind_blackboard_to(sec) {
     $("#blackboard .fragment").filter(function(){
		 var removed = parseInt($(this).attr('data-removedsec'));
		 removed = (removed!=undefined && removed < sec);
		 return (parseInt($(this).attr('data-framesec')) > sec || removed) }).fadeOut(500);
     $("#blackboard .fragment").filter(function(){
       var removed = parseInt($(this).attr('data-removedsec'));
       removed = (removed!=undefined && removed < sec);
       return (parseInt($(this).attr('data-framesec')) <= sec && !removed)}).fadeIn(500);
     $("#blackboard-time span").text(sec_to_time_string(sec));
     blackboard_paused = true;
	 current_blackboard_sec = sec;
  }

  function download_canvas(sec) {
	  var canvas = document.getElementById("canvas");
      var context = canvas.getContext("2d");
	  context.fillStyle = "black";
	  context.fillRect(0, 0, canvas.width, canvas.height);
	   $("#blackboard .fragment").each(function(){
		   var removed = parseInt($(this).attr('data-removedsec'));
		   removed = (removed!=undefined && removed < sec);
		   if (parseInt($(this).attr('data-framesec')) <= sec && !removed) {
			   var image = new Image();
               var elem = $(this);
			   image.onload = function() {
	   			   context.drawImage(image,elem.css('margin-left').replace('px',''),elem.css('margin-top').replace('px',''));
			   };
			   image.src = $(this).find("img").attr('src')
		   }});
      // window.open(canvas.toDataURL("image/png"));
  }

  $('#blackboard').on('click', '.fragment', function() {
      // alert('This goes to yt link at sec '+$(this).attr('data-framesec'));
	  window.open(make_yt_link($(this).attr('data-framesec')))
  });
  $('#gallery').on('click', '.fragment', function() {
      var sec = parseInt($(this).attr('data-framesec'));
	  rewind_blackboard_to(sec);
  });
  $('#gallery').on('mouseenter mouseleave', '.fragment', function() {
	  var sec = $(this).attr('data-framesec');
	  $('#blackboard').find('[data-framesec="'+ sec + '"]').toggleClass('fragment-hover');
  });
  $("#saveBtn").click(function() {
	  download_canvas(current_blackboard_sec);
  })
  $("#saveBtn").hide()
  $("#blackboard").hover(function(){
	  $("#saveBtn").toggle()
  });

  function nvd3_update(hist) {
	  var time_hist = [{
		  values: hist,
		  color: "#337ab7",
	  }]
	// Update the SVG with the new data and call chart
	chartData.datum(time_hist).transition().duration(500).call(chart);
	nv.utils.windowResize(chart.update);

	  // d3.selectAll("rect.nv-bar") // make positive and negative different in color
		  // .style("fill", function(d, i){
			  // return d.y > 0 ? "#337ab7":"#A94442";
		  // });
  };

  var nvd3_setup = function() {
	  chart = nv.models.historicalBarChart();
	  chart
		.margin({left: 0, bottom: 0, right:0, top:0})
	    .height(100)
		.forceY([-1000,1000])
		  // .useInteractiveGuideline(true)
		.duration(250)
	  ;

	 chart.tooltip.contentGenerator(function (d) {
          return `<div style="margin:3px">Blackboard activity at ${sec_to_time_string(d.data.x*60)}</div>`;
        })

	 chart.bars.dispatch.on("elementClick", function(e)  {
		 // console.log(e.data.x);
		 rewind_blackboard_to(parseInt(e.data.x*60))

	 });
	  // chart sub-models (ie. xAxis, yAxis, etc) when accessed directly, return themselves, not the parent chart, so need to chain separately
	  chart.xAxis
	      .axisLabel('Time')
		  .tickFormat(function(d, i){
			  return sec_to_time_string(d*60);
		  });

	  chart.showXAxis(false);
	  chart.showYAxis(false);
	  var time_hist = [{
		  values: [],
		  color: "#337ab7",
	  }]
	  chartData = d3.select('#activity-graph').datum(time_hist)
	  chartData.transition().call(chart);

	  nv.utils.windowResize(chart.update);
	  chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });
	  return chart;
  };

  var eventsource_onmessage = function (event) {
	    // console.log(event.data);
	    var data = JSON.parse(event.data);
	    var img = "data:image/png;base64,"+data.img;
	    var frame = "data:image/png;base64,"+data.frame;
	    var title = data.sec + " " + data.proba;
	    var time = sec_to_time_string(data.sec);
	    current_blackboard_sec = data.sec;
	    $("#gallery-placeholder").hide();
	    var el_gallery = null;
	    if (data.size[1]*data.size[0] > 600) {
			var html = `<li class="span2 fragment"  data-framesec="${data.sec}" data-loc-x="${data.left_corner[1]}" data-loc-y="${data.left_corner[0]}"> <a class="thumbnail" ><img src="${img}" alt="" title="${data.proba} - ${data.n_sameblobs}"/></a><span class="time-text">${time}</span></li>`
			el_gallery = $(html).hide().appendTo('#gallery')
			el_gallery.fadeIn(2000);
		}

	    var html = `<div class="fragment" data-framesec="${data.sec}" style="width:${data.size[1]+'px'};height:${data.size[0]+'px'};margin-top:${data.left_corner[0]+'px'};margin-left:${data.left_corner[1]+'px'}"><img src="${img}" alt="" /><span>${time}</span></div>`
	    var el = $(html).hide().appendTo('#blackboard')
	    if (!blackboard_paused) {
			el.fadeIn(2000);
			$('#blackboard-time span').text(time);
			if (el_gallery != null) {
				var container = $('#gallery');
				console.log([container[0].scrollWidth - container.scrollLeft(), container.outerWidth()])
				// only auto scroll if it is already at the end (else the user is probably trying to scroll so in that case don't autoscroll )
				if (container[0].scrollWidth - container.scrollLeft() < container.outerWidth()) {
					container.animate({
						scrollLeft: el_gallery.offset().left - container.offset().left + container.scrollLeft()
					});
				}
			}
		}

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

		var gallery_el = $('#gallery').find(`[data-framesec="${data.sec}"],[data-top-x="${data.left_corner[1]}"],[data-top-y="${data.left_corner[0]}"]`);
		gallery_el.attr('data-removedsec',data.removed_sec);
		var text_el = gallery_el.find(".time-text");
		var time = sec_to_time_string(data.removed_sec);
		text_el.text(text_el.text() + " - " + time);
		if (!blackboard_paused) {
			blackboard_el.fadeOut(2000);
			$('#blackboard-time span').text(time);}
   };
	var eventsource_onstart = function(e) {
		// var data = JSON.parse(e.data);
		// console.log(data.msg);
		console.log(e.data)
		var data = JSON.parse(e.data)

		// save global information
		current_video_length = data.video_length
		current_video_url = data.video_url

		$("#video-title").html(data.video_title);
		$("#video-author").html(data.video_author);
		$("#video-desc").html(data.video_desc);

		// $("#blackboard .fragment").remove();
		// $("#gallery .fragment").remove();
		// $("#blackboard-container").hide()

		// var canvas = $("#canvas").get(0);
		// canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
		$('#current-img').removeAttr('src')
	    $('#current-frame').removeAttr('src')

	};
	var eventsource_onprogress = function(e) {
		$("#blackboard-container").show()
		$('#progress-container').show();
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
		$('#progress-container').fadeOut(3000);
	};
	var eventsource_onhist = function(e){
		// console.log(e.data)
		var data = JSON.parse(e.data)
		nvd3_update(data.hist)
	}

})
