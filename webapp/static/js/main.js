$(document).ready(function() {
  $('#video-container').hide()

  var source = null;
  $('#gobtn').click(function() {
	  $('#video-container').show();
	  $("#blackboard .fragment").remove();
	  $("#gallery .fragment").remove();
	  // $("#blackboard-container").hide()
	  

	  location.href = "#video-container";
	  $("#video-title").html("Loading video...");
	  $("#video-desc").html("")
	  $("#video-author").html("")
	  $("#gallery-placeholder").fadeIn(2000);
	  $('#blackboard-time span').text("00:00:00");
	  blackboard_paused = false;

      source = new EventSource('/getImageStream/'+encodeURIComponent($("#videoUrl").val()));
	  source.addEventListener('onstart', eventsource_onstart, false);
	  source.addEventListener('onprogress', eventsource_onprogress, false);
	  source.addEventListener('onend', eventsource_onend, false);
	  source.addEventListener('onerasure', eventsource_onerasure, false);
	  source.addEventListener('onhist', eventsource_onhist, false);
	  source.onmessage = eventsource_onmessage;
	  if (chart == null) {nv.addGraph(nvd3_setup);}
  });
  $('#stopbtn').click(function() {
	  source.close();
  });

  var current_video_length = 0;
  var current_video_url = null;
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

  $('#blackboard').on('click', '.fragment', function() {
      // alert('This goes to yt link at sec '+$(this).attr('data-framesec'));
	  window.open(make_yt_link($(this).attr('data-framesec')))
  });
  $('#gallery').on('click', '.fragment', function() {
      var sec = parseInt($(this).attr('data-framesec'));
	  $("#blackboard .fragment").filter(function(){
		  return (parseInt($(this).attr('data-framesec')) > sec) }).fadeOut(500);
	  $("#blackboard .fragment").filter(function(){
		  var removed = parseInt($(this).attr('data-removedsec'));
		  removed = (removed!=undefined && removed < sec);
		  return (parseInt($(this).attr('data-framesec')) <= sec && !removed)}).fadeIn(500);
	  $("#blackboard-time span").text(sec_to_time_string(sec));
	  blackboard_paused = true;
  });
  $('#gallery').on('mouseenter mouseleave', '.fragment', function() {
	  var sec = $(this).attr('data-framesec');
	  $('#blackboard').find('[data-framesec="'+ sec + '"]').toggleClass('fragment-hover');
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
		  // .useInteractiveGuideline(true)
		  .duration(250)
	    // .tooltip(function(key, x, y, e, graph) {
			// return '<h3>' + key + '</h3>' +
				// '<p>' +  y + ' on ' + x + '</p>';
		// })
	  ;

	  // chart sub-models (ie. xAxis, yAxis, etc) when accessed directly, return themselves, not the parent chart, so need to chain separately
	  chart.xAxis
	      .axisLabel('Time')
		  .tickFormat(function(d, i){
			  // console.log([d,i])
               var hour  = Math.floor(d/60%60)
	    	var min = Math.floor(d%60);
			  return (hour < 10 ? "0"+ hour : hour)+ ":"+ (min < 10 ? "0" + min : min)
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
	    $("#gallery-placeholder").hide();
	    if (data.size[1]*data.size[0] > 600) {
			var html = `<li class="span2 fragment"  data-framesec="${data.sec}" data-loc-x="${data.left_corner[1]}" data-loc-y="${data.left_corner[0]}"> <a class="thumbnail" ><img src="${img}" alt="" title="${data.proba} - ${data.n_sameblobs}"/></a><span class="time-text">${time}</span></li>`
			$(html).hide().appendTo('#gallery').fadeIn(2000);
		}

	    var html = `<div class="fragment" data-framesec="${data.sec}" style="width:${data.size[1]+'px'};height:${data.size[0]+'px'};margin-top:${data.left_corner[0]+'px'};margin-left:${data.left_corner[1]+'px'}"><img src="${img}" alt="" /><span>${time}</span></div>`
	    var el = $(html).hide().appendTo('#blackboard')
	    if (!blackboard_paused) {
			el.fadeIn(2000);
			$('#blackboard-time span').text(time);
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
