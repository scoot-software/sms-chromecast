/*
 * Author: Scott Ware <scoot.software@gmail.com>
 * Copyright (c) 2015 Scott Ware
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
'use strict';


/**
 * Creates the namespace
 */
var smsplayer = smsplayer || {};



/**
 * SMS player constructor
 */
smsplayer.CastPlayer = function(element) {

  /**
   * The debug setting to control receiver, MPL and player logging.
   */
  this.debug_ = smsplayer.getDebug_();

  if (this.debug_) {
    cast.player.api.setLoggerLevel(cast.player.api.LoggerLevel.DEBUG);
    cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.DEBUG);
  }

  /**
   * The DOM element the player is attached.
   */
  this.element_ = element;

  /**
   * The current type of the player.
   */
  this.type_;

  this.setType_(smsplayer.Type.UNKNOWN);

  /**
   * The current state of the player.
   */
  this.state_;

  /**
   * Timestamp when state transition happened last time.
   */
  this.lastStateTransitionTime_ = 0;

  this.setState_(smsplayer.State.LAUNCHING, false);

  /**
   * The id returned by setInterval for the screen burn timer
   */
  this.burnInPreventionIntervalId_;

  /**
   * The id returned by setTimeout for the idle timer
   */
  this.idleTimerId_;

  /**
   * The id of timer to handle seeking UI.
   */
  this.seekingTimerId_;

  /**
   * The id of timer to defer setting state.
   */
  this.setStateDelayTimerId_;

  /**
   * Current application state.
   */
  this.currentApplicationState_;

  /**
   * The DOM element for the inner portion of the progress bar.
   */
  this.progressBarInnerElement_ = this.getElementByClass_(
      '.controls-progress-inner');

  /**
   * The DOM element for the thumb portion of the progress bar.
   */
  this.progressBarThumbElement_ = this.getElementByClass_(
      '.controls-progress-thumb');

  /**
   * The DOM element for the current time label.
   */
  this.curTimeElement_ = this.getElementByClass_('.controls-cur-time');

  /**
   * The DOM element for the total time label.
   */
  this.totalTimeElement_ = this.getElementByClass_('.controls-total-time');

  /**
   * Handler for buffering-related events for MediaElement.
   */
  this.bufferingHandler_ = this.onBuffering_.bind(this);

  /**
   * Media player to play given manifest.
   */
  this.player_ = null;

  /**
   * Text Tracks currently supported.
   */
  this.textTrackType_ = null;

  /**
   * Whether player app should handle autoplay behavior.
   */
  this.playerAutoPlay_ = false;

  /**
   * Id of deferred play callback
   */
  this.deferredPlayCallbackId_ = null;

  /**
   * Whether the player is ready to receive messages after a LOAD request.
   */
  this.playerReady_ = false;

  /**
   * Whether the player has received the metadata loaded event after a LOAD
   * request.
   */
  this.metadataLoaded_ = false;

  /**
   * The media element.
   */
  this.mediaElement_ =
      (this.element_.querySelector('video'));
  this.mediaElement_.addEventListener('error', this.onError_.bind(this), false);
  this.mediaElement_.addEventListener('playing', this.onPlaying_.bind(this),
      false);
  this.mediaElement_.addEventListener('pause', this.onPause_.bind(this), false);
  this.mediaElement_.addEventListener('ended', this.onEnded_.bind(this), false);
  this.mediaElement_.addEventListener('abort', this.onAbort_.bind(this), false);
  this.mediaElement_.addEventListener('timeupdate', this.onProgress_.bind(this),
      false);
  this.mediaElement_.addEventListener('seeking', this.onSeekStart_.bind(this),
      false);
  this.mediaElement_.addEventListener('seeked', this.onSeekEnd_.bind(this),
      false);


  /**
   * The cast receiver manager.
   */
  this.receiverManager_ = cast.receiver.CastReceiverManager.getInstance();
  this.receiverManager_.onReady = this.onReady_.bind(this);
  this.receiverManager_.onSenderDisconnected =
      this.onSenderDisconnected_.bind(this);
  this.receiverManager_.onVisibilityChanged =
      this.onVisibilityChanged_.bind(this);
  this.receiverManager_.setApplicationState(
      smsplayer.getApplicationState_());


  /**
   * The remote media object.
   */
  this.mediaManager_ = new cast.receiver.MediaManager(this.mediaElement_);

  /**
   * The original load callback.
   */
  this.onLoadOrig_ =
      this.mediaManager_.onLoad.bind(this.mediaManager_);
  this.mediaManager_.onLoad = this.onLoad_.bind(this);

  /**
   * The original editTracksInfo callback
   */
  this.onEditTracksInfoOrig_ =
      this.mediaManager_.onEditTracksInfo.bind(this.mediaManager_);
  this.mediaManager_.onEditTracksInfo = this.onEditTracksInfo_.bind(this);

  /**
   * The original metadataLoaded callback
   */
  this.onMetadataLoadedOrig_ =
      this.mediaManager_.onMetadataLoaded.bind(this.mediaManager_);
  this.mediaManager_.onMetadataLoaded = this.onMetadataLoaded_.bind(this);

  /**
   * The original stop callback.
   */
  this.onStopOrig_ =
      this.mediaManager_.onStop.bind(this.mediaManager_);
  this.mediaManager_.onStop = this.onStop_.bind(this);

  /**
   * The original metadata error callback.
   */
  this.onLoadMetadataErrorOrig_ =
      this.mediaManager_.onLoadMetadataError.bind(this.mediaManager_);
  this.mediaManager_.onLoadMetadataError = this.onLoadMetadataError_.bind(this);

  /**
   * The original error callback
   */
  this.onErrorOrig_ =
      this.mediaManager_.onError.bind(this.mediaManager_);
  this.mediaManager_.onError = this.onError_.bind(this);

  this.mediaManager_.customizedStatusCallback =
      this.customizedStatusCallback_.bind(this);

  this.mediaManager_.onPreload = this.onPreload_.bind(this);
  this.mediaManager_.onCancelPreload = this.onCancelPreload_.bind(this);
};


/**
 * The amount of time in a given state before the player goes idle.
 */
smsplayer.IDLE_TIMEOUT = {
  LAUNCHING: 1000 * 60 * 5, // 5 minutes
  LOADING: 1000 * 60 * 5,  // 5 minutes
  PAUSED: 1000 * 60 * 20,  // 20 minutes
  DONE: 1000 * 60 * 5,     // 5 minutes
  IDLE: 1000 * 60 * 5      // 5 minutes
};


/**
 * Describes the type of media being played.
 */
smsplayer.Type = {
  AUDIO: 'audio',
  VIDEO: 'video',
  UNKNOWN: 'unknown'
};

/**
 * Describes the type of track.
 */
smsplayer.TrackType = {
  AUDIO: 'audio',
  VIDEO: 'video'
};


/**
 * Describes the state of the player.
 */
smsplayer.State = {
  LAUNCHING: 'launching',
  LOADING: 'loading',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DONE: 'done',
  IDLE: 'idle'
};

/**
 * The amount of time (in ms) a screen should stay idle before burn in
 * prevention kicks in
 *
 */
smsplayer.BURN_IN_TIMEOUT = 30 * 1000;

/**
 * The minimum duration (in ms) that media info is displayed.
 */
smsplayer.MEDIA_INFO_DURATION_ = 3 * 1000;


/**
 * Transition animation duration (in sec).
 */
smsplayer.TRANSITION_DURATION_ = 1.5;


/**
 * Const to enable debugging.
 */
smsplayer.ENABLE_DEBUG_ = true;


/**
 * Const to disable debugging.
 */
smsplayer.DISABLE_DEBUG_ = false;


/**
 * Returns the element with the given class name
 */
smsplayer.CastPlayer.prototype.getElementByClass_ = function(className) {
  var element = this.element_.querySelector(className);
  if (element) {
    return element;
  } else {
    throw Error('Cannot find element with class: ' + className);
  }
};


/**
 * Returns this player's media element.
 */
smsplayer.CastPlayer.prototype.getMediaElement = function() {
  return this.mediaElement_;
};


/**
 * Returns this player's media manager.
 */
smsplayer.CastPlayer.prototype.getMediaManager = function() {
  return this.mediaManager_;
};


/**
 * Returns this player's MPL player.
 */
smsplayer.CastPlayer.prototype.getPlayer = function() {
  return this.player_;
};


/**
 * Starts the player.
 */
smsplayer.CastPlayer.prototype.start = function() {
  this.receiverManager_.start();
};

/**
 * Loads the given data.
 */
smsplayer.CastPlayer.prototype.load = function(info) {
  this.log_('onLoad_');
  clearTimeout(this.idleTimerId_);
  var self = this;
  var media = info.message.media || {};
  var contentType = media.contentType;
  var playerType = smsplayer.getType_(media);
  if (!media.contentId) {
    this.log_('Load failed: no content');
    self.onLoadMetadataError_(info);
  } else if (playerType === smsplayer.Type.UNKNOWN) {
    this.log_('Load failed: unknown content type: ' + contentType);
    self.onLoadMetadataError_(info);
  } else {
    this.log_('Loading: ' + playerType);
    self.resetMediaElement_();
    self.setType_(playerType);
    switch (playerType) {
      case smsplayer.Type.AUDIO:
        self.loadAudio_(info);
        break;
      case smsplayer.Type.VIDEO:
        self.loadVideo_(info);
        break;
    }
    self.playerReady_ = false;
    self.metadataLoaded_ = false;
    self.loadMetadata_(media);
    smsplayer.preload_(media, function() {
      smsplayer.transition_(self.element_, smsplayer.TRANSITION_DURATION_, function() {
        self.setState_(smsplayer.State.LOADING, false);
        // Only send load completed after we reach this point so the media
        // manager state is still loading and the sender can't send any PLAY
        // messages
        self.playerReady_ = true;
        self.maybeSendLoadCompleted_(info);
        if (self.playerAutoPlay_) {
          // Make sure media info is displayed long enough before playback
          // starts.
          self.deferPlay_(smsplayer.MEDIA_INFO_DURATION_);
          self.playerAutoPlay_ = false;
        }
      });
    });
  }
};

/**
 * Sends the load complete message to the sender if the two necessary conditions
 * are met, the player is ready for messages and the loaded metadata event has
 * been received.
 */
smsplayer.CastPlayer.prototype.maybeSendLoadCompleted_ = function(info) {
  if (!this.playerReady_) {
    this.log_('Deferring load response, player not ready');
  } else if (!this.metadataLoaded_) {
    this.log_('Deferring load response, loadedmetadata event not received');
  } else {
    this.onMetadataLoadedOrig_(info);
    this.log_('Sent load response, player is ready and metadata loaded');
  }
};

/**
 * Resets the media element.
 */
smsplayer.CastPlayer.prototype.resetMediaElement_ = function() {
  this.log_('resetMediaElement_');
  if (this.player_) {
    this.player_.unload();
    this.player_ = null;
  }
  this.textTrackType_ = null;
};


/**
 * Loads the metadata for the given media.
 */
smsplayer.CastPlayer.prototype.loadMetadata_ = function(media) {
  this.log_('loadMetadata_');
  if (!smsplayer.isCastForAudioDevice_()) {
    var metadata = media.metadata || {};
    var titleElement = this.element_.querySelector('.media-title');
    smsplayer.setInnerText_(titleElement, metadata.title);

    var subtitleElement = this.element_.querySelector('.media-subtitle');
    smsplayer.setInnerText_(subtitleElement, metadata.subtitle);

    var artwork = smsplayer.getMediaImageUrl_(media);
    if (artwork) {
      var artworkElement = this.element_.querySelector('.media-artwork');
      smsplayer.setBackgroundImage_(artworkElement, artwork);
    }
  }
};

/**
 * Lets player handle autoplay, instead of depending on underlying
 * MediaElement to handle it. By this way, we can make sure that media playback
 * starts after loading screen is displayed.
 */
smsplayer.CastPlayer.prototype.letPlayerHandleAutoPlay_ = function(info) {
  this.log_('letPlayerHandleAutoPlay_: ' + info.message.autoplay);
  var autoplay = info.message.autoplay;
  info.message.autoplay = false;
  this.mediaElement_.autoplay = false;
  this.playerAutoPlay_ = autoplay == undefined ? true : autoplay;
};


/**
 * Loads some audio content.
 */
smsplayer.CastPlayer.prototype.loadAudio_ = function(info) {
  this.log_('loadAudio_');
  this.letPlayerHandleAutoPlay_(info);
  this.loadDefault_(info);
};


/**
 * Loads some video content.
 */
smsplayer.CastPlayer.prototype.loadVideo_ = function(info) {
  this.log_('loadVideo_');
  var self = this;
  var url = info.message.media.contentId;

  this.letPlayerHandleAutoPlay_(info);
  this.log_('loadVideo_: using MediaElement');
  this.mediaElement_.addEventListener('stalled', this.bufferingHandler_,
        false);
  this.mediaElement_.addEventListener('waiting', this.bufferingHandler_,
        false);
  this.loadDefault_(info);
};

/**
 * Processes embedded tracks, if they exist.
 */
smsplayer.CastPlayer.prototype.processInBandTracks_ =
    function(activeTrackIds) {
  var protocol = this.player_.getStreamingProtocol();
  var streamCount = protocol.getStreamCount();
  for (var i = 0; i < streamCount; i++) {
    var trackId = i + 1;
    var isActive = false;
    for (var j = 0; j < activeTrackIds.length; j++) {
      if (activeTrackIds[j] == trackId) {
        isActive = true;
        break;
      }
    }
    var wasActive = protocol.isStreamEnabled(i);
    if (isActive && !wasActive) {
      protocol.enableStream(i, true);
    } else if (!isActive && wasActive) {
      protocol.enableStream(i, false);
    }
  }
};


/**
 * Reads in-band tracks info, if they exist.
 */
smsplayer.CastPlayer.prototype.readInBandTracksInfo_ = function() {
  var protocol = this.player_ ? this.player_.getStreamingProtocol() : null;
  if (!protocol) {
    return null;
  }
  var streamCount = protocol.getStreamCount();
  var activeTrackIds = [];
  var tracks = [];
  for (var i = 0; i < streamCount; i++) {
    var trackId = i + 1;
    if (protocol.isStreamEnabled(i)) {
      activeTrackIds.push(trackId);
    }
    var streamInfo = protocol.getStreamInfo(i);
    var mimeType = streamInfo.mimeType;
    var track;
    if (mimeType.indexOf(smsplayer.TrackType.VIDEO) === 0) {
      track = new cast.receiver.media.Track(
          trackId, cast.receiver.media.TrackType.VIDEO);
    } else if (mimeType.indexOf(smsplayer.TrackType.AUDIO) === 0) {
      track = new cast.receiver.media.Track(
          trackId, cast.receiver.media.TrackType.AUDIO);
    }
    if (track) {
      track.name = streamInfo.name;
      track.language = streamInfo.language;
      track.trackContentType = streamInfo.mimeType;
      tracks.push(track);
    }
  }
  if (tracks.length === 0) {
    return null;
  }
  var tracksInfo = ({
    tracks: tracks,
    activeTrackIds: activeTrackIds
  });
  return tracksInfo;
};


/**
 * Loads some media by delegating to default media manager.
 */
smsplayer.CastPlayer.prototype.loadDefault_ = function(info) {
  this.onLoadOrig_(new cast.receiver.MediaManager.Event(
      cast.receiver.MediaManager.EventType.LOAD,
      (info.message),
      info.senderId));
};


/**
 * Sets the amount of time before the player is considered idle.
 */
smsplayer.CastPlayer.prototype.setIdleTimeout_ = function(t) {
  this.log_('setIdleTimeout_: ' + t);
  var self = this;
  clearTimeout(this.idleTimerId_);
  if (t) {
    this.idleTimerId_ = setTimeout(function() {
      self.receiverManager_.stop();
    }, t);
  }
};


/**
 * Sets the type of player.
 */
smsplayer.CastPlayer.prototype.setType_ = function(type) {
  this.log_('setType_: ' + type);
  this.type_ = type;
  this.element_.setAttribute('type', type);
  var overlay = this.getElementByClass_('.overlay');
  clearInterval(this.burnInPreventionIntervalId_);
  if (type != smsplayer.Type.AUDIO) {
    overlay.removeAttribute('style');
  } else {
    // if we are in 'audio' mode float metadata around the screen to
    // prevent screen burn
    this.burnInPreventionIntervalId_ = setInterval(function() {
      overlay.style.marginBottom = Math.round(Math.random() * 100) + 'px';
      overlay.style.marginLeft = Math.round(Math.random() * 600) + 'px';
    }, smsplayer.BURN_IN_TIMEOUT);
  }
};


/**
 * Sets the state of the player.
 */
smsplayer.CastPlayer.prototype.setState_ = function(
    state, opt_crossfade, opt_delay) {
  this.log_('setState_: state=' + state + ', crossfade=' + opt_crossfade +
      ', delay=' + opt_delay);
  var self = this;
  self.lastStateTransitionTime_ = Date.now();
  clearTimeout(self.delay_);
  if (opt_delay) {
    var func = function() { self.setState_(state, opt_crossfade); };
    self.delay_ = setTimeout(func, opt_delay);
  } else {
    if (!opt_crossfade) {
      self.state_ = state;
      self.element_.setAttribute('state', state);
      self.updateApplicationState_();
      self.setIdleTimeout_(smsplayer.IDLE_TIMEOUT[state.toUpperCase()]);
    } else {
      var stateTransitionTime = self.lastStateTransitionTime_;
      smsplayer.transition_(self.element_, smsplayer.TRANSITION_DURATION_,
          function() {
            // In the case of a crossfade transition, the transition will be completed
            // even if setState is called during the transition.  We need to be sure
            // that the requested state is ignored as the latest setState call should
            // take precedence.
            if (stateTransitionTime < self.lastStateTransitionTime_) {
              self.log_('discarded obsolete deferred state(' + state + ').');
              return;
            }
            self.setState_(state, false);
          });
    }
  }
};


/**
 * Updates the application state if it has changed.
 */
smsplayer.CastPlayer.prototype.updateApplicationState_ = function() {
  this.log_('updateApplicationState_');
  if (this.mediaManager_) {
    var idle = this.state_ === smsplayer.State.IDLE;
    var media = idle ? null : this.mediaManager_.getMediaInformation();
    var applicationState = smsplayer.getApplicationState_(media);
    if (this.currentApplicationState_ != applicationState) {
      this.currentApplicationState_ = applicationState;
      this.receiverManager_.setApplicationState(applicationState);
    }
  }
};


/**
 * Called when the player is ready. We initialize the UI for the launching
 * and idle screens.
 */
smsplayer.CastPlayer.prototype.onReady_ = function() {
  this.log_('onReady');
  this.setState_(smsplayer.State.IDLE, false);
};


/**
 * Called when a sender disconnects from the app.
 */
smsplayer.CastPlayer.prototype.onSenderDisconnected_ = function(event) {
  this.log_('onSenderDisconnected');
  // When the last or only sender is connected to a receiver,
  // tapping Disconnect stops the app running on the receiver.
  if (this.receiverManager_.getSenders().length === 0 &&
      event.reason ===
          cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER) {
    this.receiverManager_.stop();
  }
};


/**
 * Called when media has an error. Transitions to IDLE state and
 * calls to the original media manager implementation.
 */
smsplayer.CastPlayer.prototype.onError_ = function(error) {
  this.log_('onError');
  var self = this;
  smsplayer.transition_(self.element_, smsplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(smsplayer.State.IDLE, true);
        self.onErrorOrig_(error);
      });
};


/**
 * Called when media is buffering. If we were previously playing,
 * transition to the BUFFERING state.
 */
smsplayer.CastPlayer.prototype.onBuffering_ = function() {
  this.log_('onBuffering[readyState=' + this.mediaElement_.readyState + ']');
  if (this.state_ === smsplayer.State.PLAYING &&
      this.mediaElement_.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    this.setState_(smsplayer.State.BUFFERING, false);
  }
};


/**
 * Called when media has started playing. We transition to the
 * PLAYING state.
 */
smsplayer.CastPlayer.prototype.onPlaying_ = function() {
  this.log_('onPlaying');
  this.cancelDeferredPlay_('media is already playing');
  var isAudio = this.type_ == smsplayer.Type.AUDIO;
  var isLoading = this.state_ == smsplayer.State.LOADING;
  var crossfade = isLoading && !isAudio;
  this.setState_(smsplayer.State.PLAYING, crossfade);
};


/**
 * Called when media has been paused. If this is an auto-pause as a result of
 * buffer underflow, we transition to BUFFERING state; otherwise, if the media
 * isn't done, we transition to the PAUSED state.
 */
smsplayer.CastPlayer.prototype.onPause_ = function() {
  this.log_('onPause');
  this.cancelDeferredPlay_('media is paused');
  var isIdle = this.state_ === smsplayer.State.IDLE;
  var isDone = this.mediaElement_.currentTime === this.mediaElement_.duration;
  var isUnderflow = this.player_ && this.player_.getState()['underflow'];
  if (isUnderflow) {
    this.log_('isUnderflow');
    this.setState_(smsplayer.State.BUFFERING, false);
    this.mediaManager_.broadcastStatus(/* includeMedia */ false);
  } else if (!isIdle && !isDone) {
    this.setState_(smsplayer.State.PAUSED, false);
  }
  this.updateProgress_();
};


/**
 * Changes player state reported to sender, if necessary.
 */
smsplayer.CastPlayer.prototype.customizedStatusCallback_ = function(
    mediaStatus) {
  this.log_('customizedStatusCallback_: playerState=' +
      mediaStatus.playerState + ', this.state_=' + this.state_);
  // TODO: remove this workaround once MediaManager detects buffering
  // immediately.
  if (mediaStatus.playerState === cast.receiver.media.PlayerState.PAUSED &&
      this.state_ === smsplayer.State.BUFFERING) {
    mediaStatus.playerState = cast.receiver.media.PlayerState.BUFFERING;
  }
  return mediaStatus;
};


/**
 * Called when we receive a STOP message. We stop the media and transition
 * to the IDLE state.
 */
smsplayer.CastPlayer.prototype.onStop_ = function(event) {
  this.log_('onStop');
  this.cancelDeferredPlay_('media is stopped');
  var self = this;
  smsplayer.transition_(self.element_, smsplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(smsplayer.State.IDLE, false);
        self.onStopOrig_(event);
      });
};


/**
 * Called when media has ended. We transition to the IDLE state.
 */
smsplayer.CastPlayer.prototype.onEnded_ = function() {
  this.log_('onEnded');
  this.setState_(smsplayer.State.IDLE, true);
};


/**
 * Called when media has been aborted. We transition to the IDLE state.
 */
smsplayer.CastPlayer.prototype.onAbort_ = function() {
  this.log_('onAbort');
  this.setState_(smsplayer.State.IDLE, true);
};


/**
 * Called periodically during playback, to notify changes in playback position.
 * We transition to PLAYING state, if we were in BUFFERING or LOADING state.
 */
smsplayer.CastPlayer.prototype.onProgress_ = function() {
  // if we were previously buffering, update state to playing
  if (this.state_ === smsplayer.State.BUFFERING ||
      this.state_ === smsplayer.State.LOADING) {
    this.setState_(smsplayer.State.PLAYING, false);
  }
  this.updateProgress_();
};


/**
 * Updates the current time and progress bar elements.
 */
smsplayer.CastPlayer.prototype.updateProgress_ = function() {
  // Update the time and the progress bar
  if (!smsplayer.isCastForAudioDevice_()) {
    var curTime = this.mediaElement_.currentTime;
    var totalTime = this.mediaElement_.duration;
    if (!isNaN(curTime) && !isNaN(totalTime)) {
      var pct = 100 * (curTime / totalTime);
      this.curTimeElement_.innerText = smsplayer.formatDuration_(curTime);
      this.totalTimeElement_.innerText = smsplayer.formatDuration_(totalTime);
      this.progressBarInnerElement_.style.width = pct + '%';
      this.progressBarThumbElement_.style.left = pct + '%';
    }
  }
};


/**
 * Callback called when user starts seeking
 */
smsplayer.CastPlayer.prototype.onSeekStart_ = function() {
  this.log_('onSeekStart');
  clearTimeout(this.seekingTimeoutId_);
  this.element_.classList.add('seeking');
};


/**
 * Callback called when user stops seeking.
 */
smsplayer.CastPlayer.prototype.onSeekEnd_ = function() {
  this.log_('onSeekEnd');
  clearTimeout(this.seekingTimeoutId_);
  this.seekingTimeoutId_ = smsplayer.addClassWithTimeout_(this.element_,
      'seeking', 3000);
};


/**
 * Called when the player is added/removed from the screen because HDMI
 * input has changed. If we were playing but no longer visible, pause
 * the currently playing media.
 */
smsplayer.CastPlayer.prototype.onVisibilityChanged_ = function(event) {
  this.log_('onVisibilityChanged');
  if (!event.isVisible) {
    this.mediaElement_.pause();
    this.mediaManager_.broadcastStatus(false);
  }
};


/**
 * Called when we receive a PRELOAD message.
 */
smsplayer.CastPlayer.prototype.onPreload_ = function(event) {
  this.log_('onPreload_');
  var loadRequestData = (event.data);
  return this.preload(loadRequestData.media);
};


/**
 * Called when we receive a CANCEL_PRELOAD message.
 */
smsplayer.CastPlayer.prototype.onCancelPreload_ = function(event) {
  this.log_('onCancelPreload_');
  return true;
};


/**
 * Called when we receive a LOAD message. Calls load().
 */
smsplayer.CastPlayer.prototype.onLoad_ = function(event) {
  this.log_('onLoad_');
  this.cancelDeferredPlay_('new media is loaded');
  this.load(new cast.receiver.MediaManager.LoadInfo((event.data), event.senderId));
};


/**
 * Called when we receive a EDIT_TRACKS_INFO message.
 */
smsplayer.CastPlayer.prototype.onEditTracksInfo_ = function(event) {
  this.log_('onEditTracksInfo');
  this.onEditTracksInfoOrig_(event);

  var mediaInformation = this.mediaManager_.getMediaInformation() || {};
};


/**
 * Called when metadata is loaded.
 */
smsplayer.CastPlayer.prototype.onMetadataLoaded_ = function(info) {
  this.log_('onMetadataLoaded');
  this.onLoadSuccess_();
  
  // Only send load completed when we have completed the player LOADING state
  this.metadataLoaded_ = true;
  this.maybeSendLoadCompleted_(info);
};


/**
 * Called when the media could not be successfully loaded. Transitions to
 * IDLE state and calls the original media manager implementation.
 */
smsplayer.CastPlayer.prototype.onLoadMetadataError_ = function(event) {
  this.log_('onLoadMetadataError_');
  var self = this;
  smsplayer.transition_(self.element_, smsplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(smsplayer.State.IDLE, true);
        self.onLoadMetadataErrorOrig_(event);
      });
};


/**
 * Cancels deferred playback.
 */
smsplayer.CastPlayer.prototype.cancelDeferredPlay_ = function(cancelReason) {
  if (this.deferredPlayCallbackId_) {
    this.log_('Cancelled deferred playback: ' + cancelReason);
    clearTimeout(this.deferredPlayCallbackId_);
    this.deferredPlayCallbackId_ = null;
  }
};


/**
 * Defers playback start by given timeout.
 */
smsplayer.CastPlayer.prototype.deferPlay_ = function(timeout) {
  this.log_('Defering playback for ' + timeout + ' ms');
  var self = this;
  this.deferredPlayCallbackId_ = setTimeout(function() {
    self.deferredPlayCallbackId_ = null;
    if (self.player_) {
      self.log_('Playing when enough data');
      self.player_.playWhenHaveEnoughData();
    } else {
      self.log_('Playing');
      self.mediaElement_.play();
    }
  }, timeout);
};


/**
 * Called when the media is successfully loaded. Updates the progress bar.
 */
smsplayer.CastPlayer.prototype.onLoadSuccess_ = function() {
  this.log_('onLoadSuccess');
  // we should have total time at this point, so update the label
  // and progress bar
  var totalTime = this.mediaElement_.duration;
  if (!isNaN(totalTime)) {
    this.totalTimeElement_.textContent =
        smsplayer.formatDuration_(totalTime);
  } else {
    this.totalTimeElement_.textContent = '';
    this.progressBarInnerElement_.style.width = '100%';
    this.progressBarThumbElement_.style.left = '100%';
  }
};


/**
 * Returns the image url for the given media object.
 */
smsplayer.getMediaImageUrl_ = function(media) {
  var metadata = media.metadata || {};
  var images = metadata['images'] || [];
  return images && images[0] && images[0]['url'];
};

/**
 * Returns the type of player to use for the given media.
 * By default this looks at the media's content type, but falls back
 * to file extension if not set.
 */
smsplayer.getType_ = function(media) {
  var contentId = media.contentId || '';
  var contentType = media.contentType || '';
  var contentUrlPath = smsplayer.getPath_(contentId);
  if (contentType.indexOf('audio/') === 0) {
    return smsplayer.Type.AUDIO;
  } else if (contentType.indexOf('video/') === 0) {
    return smsplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/x-mpegurl') === 0) {
    return smsplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/vnd.apple.mpegurl') === 0) {
    return smsplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/dash+xml') === 0) {
    return smsplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/vnd.ms-sstr+xml') === 0) {
    return smsplayer.Type.VIDEO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'mp3') {
    return smsplayer.Type.AUDIO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'oga') {
    return smsplayer.Type.AUDIO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'wav') {
    return smsplayer.Type.AUDIO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'mp4') {
    return smsplayer.Type.VIDEO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'ogv') {
    return smsplayer.Type.VIDEO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'webm') {
    return smsplayer.Type.VIDEO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'm3u8') {
    return smsplayer.Type.VIDEO;
  } else if (smsplayer.getExtension_(contentUrlPath) === 'mpd') {
    return smsplayer.Type.VIDEO;
  } else if (contentType.indexOf('.ism') != 0) {
    return smsplayer.Type.VIDEO;
  }
  return smsplayer.Type.UNKNOWN;
};


/**
 * Formats the given duration.
 */
smsplayer.formatDuration_ = function(dur) {
  dur = Math.floor(dur);
  function digit(n) { return ('00' + Math.round(n)).slice(-2); }
  var hr = Math.floor(dur / 3600);
  var min = Math.floor(dur / 60) % 60;
  var sec = dur % 60;
  if (!hr) {
    return digit(min) + ':' + digit(sec);
  } else {
    return digit(hr) + ':' + digit(min) + ':' + digit(sec);
  }
};


/**
 * Adds the given className to the given element for the specified amount of
 * time.
 */
smsplayer.addClassWithTimeout_ = function(element, className, timeout) {
  element.classList.add(className);
  return setTimeout(function() {
    element.classList.remove(className);
  }, timeout);
};


/**
 * Causes the given element to fade out, does something, and then fades
 * it back in.
 */
smsplayer.transition_ = function(element, time, something) {
  if (time <= 0 || smsplayer.isCastForAudioDevice_()) {
    // No transitions supported for Cast for Audio devices
    something();
  } else {
    smsplayer.fadeOut_(element, time / 2.0, function() {
      something();
      smsplayer.fadeIn_(element, time / 2.0);
    });
  }
};


/**
 * Preloads media data that can be preloaded.
 */
smsplayer.preload_ = function(media, doneFunc) {
  if (smsplayer.isCastForAudioDevice_()) {
    // No preloading for Cast for Audio devices
    doneFunc();
    return;
  }

  var imagesToPreload = [];
  var counter = 0;
  var images = [];
  function imageLoaded() {
      if (++counter === imagesToPreload.length) {
        doneFunc();
      }
  }

  // try to preload image metadata
  var thumbnailUrl = smsplayer.getMediaImageUrl_(media);
  if (thumbnailUrl) {
    imagesToPreload.push(thumbnailUrl);
  }
  if (imagesToPreload.length === 0) {
    doneFunc();
  } else {
    for (var i = 0; i < imagesToPreload.length; i++) {
      images[i] = new Image();
      images[i].src = imagesToPreload[i];
      images[i].onload = function() {
        imageLoaded();
      };
      images[i].onerror = function() {
        imageLoaded();
      };
    }
  }
};


/**
 * Causes the given element to fade in.
 */
smsplayer.fadeIn_ = function(element, time, opt_doneFunc) {
  smsplayer.fadeTo_(element, '', time, opt_doneFunc);
};


/**
 * Causes the given element to fade out.
 */
smsplayer.fadeOut_ = function(element, time, opt_doneFunc) {
  smsplayer.fadeTo_(element, 0, time, opt_doneFunc);
};


/**
 * Causes the given element to fade to the given opacity in the given
 * amount of time.
 */
smsplayer.fadeTo_ = function(element, opacity, time, opt_doneFunc) {
  var self = this;
  var id = Date.now();
  var listener = function() {
    element.style.webkitTransition = '';
    element.removeEventListener('webkitTransitionEnd', listener, false);
    if (opt_doneFunc) {
      opt_doneFunc();
    }
  };
  element.addEventListener('webkitTransitionEnd', listener, false);
  element.style.webkitTransition = 'opacity ' + time + 's';
  element.style.opacity = opacity;
};


/**
 * Utility function to get the extension of a URL file path.
 */
smsplayer.getExtension_ = function(url) {
  var parts = url.split('.');
  // Handle files with no extensions and hidden files with no extension
  if (parts.length === 1 || (parts[0] === '' && parts.length === 2)) {
    return '';
  }
  return parts.pop().toLowerCase();
};


/**
 * Returns the application state.
 */
smsplayer.getApplicationState_ = function(opt_media) {
  if (opt_media && opt_media.metadata && opt_media.metadata.title) {
    return 'Now Casting: ' + opt_media.metadata.title;
  } else if (opt_media) {
    return 'Now Casting';
  } else {
    return 'Ready To Cast';
  }
};


/**
 * Returns the URL path.
 */
smsplayer.getPath_ = function(url) {
  var href = document.createElement('a');
  href.href = url;
  return href.pathname || '';
};


/**
 * Logging utility.
 */
smsplayer.CastPlayer.prototype.log_ = function(message) {
  if (this.debug_ && message) {
    console.log(message);
  }
};


/**
 * Sets the inner text for the given element.
 */
smsplayer.setInnerText_ = function(element, opt_text) {
  if (!element) {
    return;
  }
  element.innerText = opt_text || '';
};


/**
 * Sets the background image for the given element.
 */
smsplayer.setBackgroundImage_ = function(element, opt_url) {
  if (!element) {
    return;
  }
  element.style.backgroundImage =
      (opt_url ? 'url("' + opt_url.replace(/"/g, '\\"') + '")' : 'none');
  element.style.display = (opt_url ? '' : 'none');
};


/**
 * Called to determine if the receiver device is an audio device.
 */
smsplayer.isCastForAudioDevice_ = function() {
  var receiverManager = window.cast.receiver.CastReceiverManager.getInstance();
  if (receiverManager) {
    var deviceCapabilities = receiverManager.getDeviceCapabilities();
    if (deviceCapabilities) {
      return deviceCapabilities['display_supported'] === false;
    }
  }
  return false;
};

/**
 * Called to determine if debugging is enabled.
 */
smsplayer.getDebug_ = function() {
  if (window.location.href.indexOf('Debug=true') != -1) {
	return smsplayer.ENABLE_DEBUG_;
  }

  return smsplayer.DISABLE_DEBUG_;
};
