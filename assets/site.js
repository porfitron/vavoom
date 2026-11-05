(function () {
  var modals = document.querySelectorAll(".modal");
  var openers = document.querySelectorAll("[data-modal-target]");
  var videoPlayerSlot = document.getElementById("video-player-slot");
  var videoTitle = document.getElementById("video-lightbox-title");
  var videoFallbackLink = document.getElementById("video-player-fallback-link");
  var trackedSections = {};
  var trackedScrollThresholds = {};
  function hasGtag() {
    return typeof window.gtag === "function";
  }

  function trackEvent(eventName, params) {
    if (!hasGtag()) return;
    window.gtag("event", eventName, params || {});
  }

  function getText(element) {
    if (!element) return "";
    return (element.textContent || "").replace(/\s+/g, " ").trim();
  }

  var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fillDateSquare(dayEl, monthEl, endDate) {
    if (!dayEl || !monthEl || isNaN(endDate.getTime())) return;
    dayEl.textContent = endDate.getDate();
    monthEl.textContent = monthNames[endDate.getMonth()].toUpperCase();
  }

  function enhanceScheduleCards() {
    document.querySelectorAll(".show-item[data-show-end]").forEach(function (item) {
      var end = new Date(item.getAttribute("data-show-end"));
      if (isNaN(end.getTime())) return;

      var square = item.querySelector(".show-date-square");
      if (!square) {
        square = document.createElement("div");
        square.className = "show-date-square";
        square.setAttribute("aria-hidden", "true");

        var month = document.createElement("span");
        month.className = "show-date-month";
        var day = document.createElement("span");
        day.className = "show-date-day";

        square.appendChild(month);
        square.appendChild(day);
        item.insertBefore(square, item.firstChild);
      }

      fillDateSquare(square.querySelector(".show-date-day"), square.querySelector(".show-date-month"), end);
    });
  }

  function hidePastShows() {
    var items = document.querySelectorAll(".show-item[data-show-end]");
    var now = new Date();
    items.forEach(function (item) {
      var end = new Date(item.getAttribute("data-show-end"));
      if (!isNaN(end.getTime()) && end < now) {
        item.classList.add("is-past");
        item.setAttribute("aria-hidden", "true");
      }
    });
  }

  function slugifyEventId(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function ensureEventId(item) {
    var existing = item.getAttribute("data-event-id");
    if (existing) return existing;
    var end = item.getAttribute("data-show-end") || "";
    var datePart = end.slice(0, 10);
    var venuePlace = item.querySelector(".show-venue-place");
    var venueName = venuePlace ? venuePlace.textContent.split("·")[0].trim() : "event";
    var id = datePart + "-" + slugifyEventId(venueName);
    item.setAttribute("data-event-id", id);
    return id;
  }

  function ensureAllEventIds() {
    document.querySelectorAll(".show-item[data-show-end]").forEach(ensureEventId);
  }

  function formatOnTheHourTimes(text) {
    return String(text || "").replace(/(\d+):00\s*(AM|PM)/gi, "$1 $2");
  }

  function getEventDatetimeText(item) {
    var datetimeEl = item.querySelector(".show-datetime");
    return datetimeEl ? formatOnTheHourTimes(getText(datetimeEl)) : "";
  }

  function getEventVenuePlaceText(item) {
    var venuePlace = item.querySelector(".show-venue-place");
    return venuePlace ? getText(venuePlace) : "";
  }

  function getEventAddress(item) {
    return item.getAttribute("data-event-address") || "";
  }

  function getEventVenueLocation(item) {
    var place = getEventVenuePlaceText(item);
    var address = getEventAddress(item);
    if (!place) return address;
    if (!address) return place;
    return place + " · " + address;
  }

  function getEventVenueHtml(item) {
    var venuePlace = item.querySelector(".show-venue-place");
    var address = getEventAddress(item);
    if (!venuePlace) return address;
    if (!address) return venuePlace.outerHTML;
    return venuePlace.outerHTML + " · " + address;
  }

  function getCanonicalDatesUrl() {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return new URL("dates.html", window.location.href).toString();
    }
    return "https://www.sandyvavoom.com/dates.html";
  }

  function getEventShareUrl(eventId) {
    var shareUrl = new URL(getCanonicalDatesUrl(), window.location.origin);
    shareUrl.searchParams.set("event", eventId);
    return shareUrl.toString();
  }

  function getEventIdFromUrl() {
    return new URLSearchParams(window.location.search).get("event");
  }

  function clearEventUrl() {
    var params = new URLSearchParams(window.location.search);
    if (!params.has("event")) return;
    params.delete("event");
    var nextSearch = params.toString();
    var nextUrl = window.location.pathname + (nextSearch ? "?" + nextSearch : "") + window.location.hash;
    history.replaceState({}, document.title, nextUrl);
  }

  function setEventUrl(eventId, usePush) {
    var nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("event", eventId);
    if (usePush) {
      history.pushState({ eventId: eventId }, "", nextUrl.toString());
    } else {
      history.replaceState({ eventId: eventId }, "", nextUrl.toString());
    }
  }

  var activeCalendarEvent = null;
  var calendarMenu = document.getElementById("event-calendar-menu");
  var calendarToggle = document.getElementById("event-calendar-toggle");

  function toCalendarStamp(isoLocal) {
    return (isoLocal || "").replace(/[-:]/g, "").slice(0, 15);
  }

  function toCalendarUtcStamp(date) {
    var pad = function (value) {
      return String(value).padStart(2, "0");
    };
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  }

  function escapeICS(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function buildCalendarEventFromItem(item, eventId) {
    var act = getText(item.querySelector(".show-act-pill"));
    var venueName = getEventVenuePlaceText(item).split("·")[0].trim() || "Venue";
    var location = getEventVenueLocation(item);
    var mapsUrl = (item.getAttribute("data-event-maps") || "").replace(/&amp;/g, "&");
    var shareUrl = getEventShareUrl(eventId);
    var description =
      act +
      " live performance.\n\n" +
      getEventDatetimeText(item) +
      "\n\n" +
      location +
      "\n\nMore info: " +
      shareUrl +
      (mapsUrl ? "\n\nDirections: " + mapsUrl : "");

    return {
      title: act + " at " + venueName,
      start: item.getAttribute("data-show-start") || "",
      end: item.getAttribute("data-show-end") || "",
      location: location,
      description: description,
      filename: slugifyEventId(eventId) + ".ics"
    };
  }

  function openGoogleCalendar(event) {
    if (!event || !event.start || !event.end) return;
    var url =
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" +
      encodeURIComponent(event.title) +
      "&dates=" +
      encodeURIComponent(toCalendarStamp(event.start) + "/" + toCalendarStamp(event.end)) +
      "&details=" +
      encodeURIComponent(event.description) +
      "&location=" +
      encodeURIComponent(event.location);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadICS(event) {
    if (!event || !event.start || !event.end) return;
    var ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sandy VaVoom//Event//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + slugifyEventId(event.title) + "-" + toCalendarStamp(event.start) + "@sandyvavoom.com",
      "DTSTAMP:" + toCalendarUtcStamp(new Date()),
      "DTSTART:" + toCalendarStamp(event.start),
      "DTEND:" + toCalendarStamp(event.end),
      "SUMMARY:" + escapeICS(event.title),
      "DESCRIPTION:" + escapeICS(event.description),
      "LOCATION:" + escapeICS(event.location),
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = event.filename || "sandy-vavoom-event.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function closeCalendarMenu() {
    if (!calendarMenu || !calendarToggle) return;
    calendarMenu.classList.remove("is-open");
    calendarToggle.setAttribute("aria-expanded", "false");
  }

  function toggleCalendarMenu() {
    if (!calendarMenu || !calendarToggle) return;
    var isOpen = calendarMenu.classList.toggle("is-open");
    calendarToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function initCalendarMenu() {
    if (!calendarMenu || !calendarToggle) return;

    calendarToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleCalendarMenu();
    });

    calendarMenu.querySelectorAll("[data-calendar-option]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!activeCalendarEvent) return;
        var option = button.getAttribute("data-calendar-option");
        if (option === "google") {
          openGoogleCalendar(activeCalendarEvent);
          trackEvent("calendar_add_click", { calendar_type: "google" });
        } else if (option === "ical") {
          downloadICS(activeCalendarEvent);
          trackEvent("calendar_add_click", { calendar_type: "ical" });
        } else if (option === "ics") {
          downloadICS(activeCalendarEvent);
          trackEvent("calendar_add_click", { calendar_type: "ics" });
        }
        closeCalendarMenu();
      });
    });

    document.addEventListener("click", function (event) {
      if (!calendarMenu.classList.contains("is-open")) return;
      if (event.target.closest(".event-calendar-wrap")) return;
      closeCalendarMenu();
    });
  }

  function openEventModal(eventId, options) {
    options = options || {};
    ensureAllEventIds();
    var item = document.querySelector('.show-item[data-event-id="' + eventId + '"]');
    if (!item) return false;

    var actEl = document.getElementById("event-modal-act");
    var datetimeEl = document.getElementById("event-modal-datetime");
    var venueEl = document.getElementById("event-modal-venue");
    var dayEl = document.getElementById("event-modal-date-day");
    var monthEl = document.getElementById("event-modal-date-month");
    var mapsEl = document.getElementById("event-modal-maps");
    var qrEl = document.getElementById("event-modal-qr");
    var mapsUrl = item.getAttribute("data-event-maps") || "#";
    var shareUrl = getEventShareUrl(eventId);
    var end = new Date(item.getAttribute("data-show-end"));

    fillDateSquare(dayEl, monthEl, end);
    if (actEl) actEl.textContent = getText(item.querySelector(".show-act-pill"));
    if (datetimeEl) datetimeEl.textContent = getEventDatetimeText(item);
    if (venueEl) venueEl.innerHTML = getEventVenueHtml(item);
    if (mapsEl) {
      mapsEl.href = mapsUrl;
      mapsEl.style.display = mapsUrl === "#" ? "none" : "inline-flex";
    }
    if (qrEl) {
      qrEl.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=" +
        encodeURIComponent(shareUrl);
      qrEl.alt = "QR code for " + getText(item.querySelector(".show-act-pill")) + " on sandyvavoom.com";
    }

    closeCalendarMenu();
    closeAllModals();
    activeCalendarEvent = buildCalendarEventFromItem(item, eventId);

    if (options.updateUrl !== false) {
      setEventUrl(eventId, true);
    }

    var modal = document.getElementById("event-detail-modal");
    if (!modal) return false;
    modal.setAttribute("aria-hidden", "false");
    trackEvent("modal_open", {
      modal_id: "event-detail-modal",
      event_id: eventId
    });
    return true;
  }

  function initEventModals() {
    ensureAllEventIds();
    initCalendarMenu();

    document.querySelectorAll(".show-item[data-show-end]").forEach(function (item) {
      if (!item.classList.contains("is-past")) {
        var act = getText(item.querySelector(".show-act-pill"));
        var datetime = getEventDatetimeText(item);
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-label", act + ". " + datetime + ". View event details.");
      }

      function openRowEventModal() {
        if (item.classList.contains("is-past")) return;
        var eventId = ensureEventId(item);
        openEventModal(eventId);
        trackEvent("schedule_event_info_click", {
          event_id: eventId
        });
      }

      item.addEventListener("click", openRowEventModal);
      item.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRowEventModal();
        }
      });
    });

    window.addEventListener("popstate", function () {
      var eventId = getEventIdFromUrl();
      if (eventId) {
        openEventModal(eventId, { updateUrl: false });
        return;
      }
      closeAllModals();
    });

    var deepLinkEventId = getEventIdFromUrl();
    if (!deepLinkEventId) return;
    if (openEventModal(deepLinkEventId, { updateUrl: false })) {
      window.setTimeout(function () {
        var schedule = document.getElementById("schedule");
        if (schedule) schedule.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }

  function trackSectionViews() {
    var sections = document.querySelectorAll("main section[id]");
    if (!sections.length || !("IntersectionObserver" in window)) return;
    var pageName = window.location.pathname.split("/").pop().replace(/\.html$/, "") || "index";

    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var sectionId = entry.target.id;
          if (!sectionId || trackedSections[sectionId]) return;
          trackedSections[sectionId] = true;
          trackEvent("section_view", {
            section_id: sectionId,
            section_title: getText(entry.target.querySelector("h1, h2")) || sectionId,
            page_name: pageName
          });
        });
      },
      { threshold: 0.4 }
    );

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  function trackScrollDepth() {
    var scrollRoot = document.documentElement;
    var docHeight = Math.max(scrollRoot.scrollHeight - window.innerHeight, 1);
    var progress = Math.min(Math.max(window.scrollY / docHeight, 0), 1);
    [25, 50, 75, 90].forEach(function (threshold) {
      if (progress >= threshold / 100 && !trackedScrollThresholds[threshold]) {
        trackedScrollThresholds[threshold] = true;
        trackEvent("scroll_depth", {
          percent_scrolled: threshold
        });
      }
    });
  }

  function getSocialPlatformFromLink(link) {
    try {
      var url = new URL(link.href);
      var host = url.hostname.toLowerCase();
      if (host.indexOf("facebook.com") !== -1) return "facebook";
      if (host.indexOf("instagram.com") !== -1) return "instagram";
      if (host.indexOf("youtube.com") !== -1 || host.indexOf("youtu.be") !== -1) return "youtube";
      if (url.origin === window.location.origin) {
        if (url.pathname.indexOf("/music") !== -1) return "music_player";
        return "internal";
      }
    } catch (err) {
      // ignore
    }
    return "other";
  }

  function trackSocialClicks() {
    var socialLinks = document.querySelectorAll("#contact .social-links a.social-link");
    socialLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        var label = getText(link) || link.getAttribute("href") || "";
        trackEvent("social_link_click", {
          social_platform: getSocialPlatformFromLink(link),
          link_text: label,
          link_url: link.href,
          source_section: "contact"
        });
      });
    });
  }

  function trackLinkClicks() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href") || "";
      var label = getText(link) || href;
      var section = (link.closest("section[id]") || {}).id || "global";

      var isSameSitePage = link.host === window.location.host && /^https?:$/.test(link.protocol);
      if ((href.indexOf("#") === 0 && href.length > 1) || isSameSitePage) {
        trackEvent("select_content", {
          content_type: "internal_link",
          link_text: label,
          link_url: href,
          source_section: section
        });
      }

      if (link.host && link.host !== window.location.host) {
        if (link.closest(".social-links")) {
          return;
        }
        trackEvent("click", {
          link_url: link.href,
          link_domain: link.host,
          link_text: label,
          outbound: true,
          source_section: section
        });
      }
    });
  }

  function trackCtaClicks() {
    var bookingButtons = document.querySelectorAll("a.btn.primary[data-booking-act]");
    bookingButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var card = button.closest(".card");
        trackEvent("begin_checkout", {
          funnel_step: "booking_cta_click",
          cta_text: getText(button),
          act_name: card ? getText(card.querySelector("h3")) : "general_booking"
        });
      });
    });

    var contactButtons = document.querySelectorAll("[data-modal-target='contact-info-modal']");
    contactButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        trackEvent("contact_cta_click", {
          cta_text: getText(button),
          source_section: (button.closest("section[id]") || {}).id || "global"
        });
      });
    });

    var scheduleLink = document.querySelector("#schedule .section-copy a");
    if (scheduleLink) {
      scheduleLink.addEventListener("click", function () {
        trackEvent("schedule_events_click", {
          cta_text: getText(scheduleLink)
        });
      });
    }
  }

  function closeAllModals() {
    var eventModal = document.getElementById("event-detail-modal");
    var eventModalWasOpen = eventModal && eventModal.getAttribute("aria-hidden") === "false";

    modals.forEach(function (modal) {
      modal.setAttribute("aria-hidden", "true");
    });
    if (eventModalWasOpen) {
      clearEventUrl();
    }
    closeCalendarMenu();
    activeCalendarEvent = null;
    if (videoPlayerSlot) {
      videoPlayerSlot.innerHTML = "";
    }
    if (videoFallbackLink) {
      videoFallbackLink.setAttribute("href", "#");
    }
  }

  function openModalById(modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) return;
    closeAllModals();
    modal.setAttribute("aria-hidden", "false");
    trackEvent("modal_open", {
      modal_id: modalId
    });
  }

  if (openers.length) {
    openers.forEach(function (opener) {
      opener.addEventListener("click", function (event) {
        event.preventDefault();
        var modalId = opener.getAttribute("data-modal-target");
        if (modalId) openModalById(modalId);
      });
    });
  }

  if (modals.length) {
    modals.forEach(function (modal) {
      var closeButton = modal.querySelector(".modal-close");
      if (closeButton) {
        closeButton.addEventListener("click", function () {
          trackEvent("modal_close", {
            modal_id: modal.id || "unknown",
            close_method: "button"
          });
          closeAllModals();
        });
      }

      modal.addEventListener("click", function (event) {
        if (event.target === modal) {
          trackEvent("modal_close", {
            modal_id: modal.id || "unknown",
            close_method: "outside_click"
          });
          closeAllModals();
        }
      });
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      trackEvent("modal_close", {
        close_method: "escape_key"
      });
      closeAllModals();
    }
  });

  var defaultVideoUrls = [
    "https://www.youtube.com/watch?v=fg0GH_9Ct9w",
    "https://www.youtube.com/watch?v=aktoCvFViqA",
    "https://www.youtube.com/watch?v=PA0r-eNBl6g",
    "https://www.youtube.com/watch?v=c1jfeWlH_zs",
    "https://www.youtube.com/watch?v=YbOAlWTjGJo",
    "https://www.youtube.com/watch?v=cNlgwDougIQ",
    "https://www.youtube.com/watch?v=oR1xhQW2iR4",
    "https://www.youtube.com/watch?v=K6gkUqYZVxE",
    "https://www.youtube.com/watch?v=zOLA6XZV2Eg"
  ];
  var videoTrack = document.querySelector("[data-video-track]");
  var carouselPrev = document.querySelector("[data-carousel-prev]");
  var carouselNext = document.querySelector("[data-carousel-next]");
  var aboutGalleryImage = document.querySelector("[data-about-gallery-image]");
  var aboutGalleryPrev = document.querySelector("[data-about-prev]");
  var aboutGalleryNext = document.querySelector("[data-about-next]");
  var aboutGalleryCaption = document.querySelector("[data-about-caption]");
  var aboutGalleryItems = [
    {
      src: "images/640399701_122166253832615109_1709462631971526688_n.jpg",
      caption: "Leopard Lounge with Daniel Moreno"
    },
    {
      src: "images/466166281_122100252680615109_7539982059140891620_n.jpg",
      caption: "Sandy VaVoom Band at The Pour House"
    },
    {
      src: "images/489841527_122131919618615109_767315884750995338_n.jpg",
      caption: "Sandy VaVoom"
    },
    {
      src: "images/508619619_3168220143334013_7910526792250283597_n.jpg",
      caption: "VaVoom Trio"
    },
    {
      src: "images/508692651_3168220173334010_4487582443104189219_n.jpg",
      caption: "Sandy at the Madonna Inn"
    },
    {
      src: "images/603896780_122161467914615109_8491019094126969195_n.jpg",
      caption: "Another song at The Madonna Inn"
    }
  ];

  function extractYouTubeId(url) {
    try {
      var parsed = new URL(url);
      if (parsed.hostname.indexOf("youtu.be") > -1) {
        return parsed.pathname.replace("/", "");
      }
      return parsed.searchParams.get("v");
    } catch (err) {
      return null;
    }
  }

  function fetchYouTubeTitle(url) {
    var endpoint = "https://www.youtube.com/oembed?url=" + encodeURIComponent(url) + "&format=json";
    return fetch(endpoint)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Could not fetch video title");
        }
        return response.json();
      })
      .then(function (payload) {
        if (payload && payload.title) {
          return payload.title;
        }
        throw new Error("Missing title field");
      });
  }

  function truncateTitle(title, maxLength) {
    if (!title || title.length <= maxLength) return title;
    return title.slice(0, maxLength - 3).trimEnd() + "...";
  }

  function mountVideoPlayer(videoId, label) {
    if (!videoPlayerSlot) return;
    videoPlayerSlot.innerHTML = "";
    var frame = document.createElement("iframe");
    frame.title = label || "Sandy VaVoom performance sample video";
    frame.setAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/" +
        videoId +
        "?rel=0&modestbranding=1&playsinline=1"
    );
    frame.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    videoPlayerSlot.appendChild(frame);
  }

  function openVideoLightbox(videoId, label) {
    if (!videoId || !videoPlayerSlot) return;
    if (videoTitle && label) {
      videoTitle.textContent = label;
    }
    trackEvent("video_start", {
      video_id: videoId,
      video_title: label || "Performance Sample"
    });
    openModalById("video-lightbox-modal");
    if (videoFallbackLink) {
      videoFallbackLink.setAttribute("href", "https://www.youtube.com/watch?v=" + videoId);
    }
    mountVideoPlayer(videoId, label);
  }

  function renderVideoThumbnails(videoUrls) {
    if (!videoTrack) return;
    videoTrack.innerHTML = "";
    var renderedAny = false;
    videoUrls.forEach(function (url, index) {
      var videoId = extractYouTubeId(url);
      if (!videoId) return;
      renderedAny = true;

      var thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "video-thumb";
      thumb.setAttribute("aria-label", "Play performance sample " + (index + 1));

      var thumbImage = document.createElement("img");
      thumbImage.src = "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
      thumbImage.alt = "Performance sample " + (index + 1) + " thumbnail";
      thumbImage.loading = "lazy";

      var thumbLabel = document.createElement("span");
      var fallbackTitle = "Performance Sample " + (index + 1);
      thumbLabel.textContent = fallbackTitle;
      thumb.setAttribute("data-video-title", fallbackTitle);

      thumb.appendChild(thumbImage);
      thumb.appendChild(thumbLabel);
      thumb.addEventListener("click", function () {
        openVideoLightbox(videoId, thumb.getAttribute("data-video-title") || fallbackTitle);
      });
      videoTrack.appendChild(thumb);

      fetchYouTubeTitle(url)
        .then(function (title) {
          thumbLabel.textContent = truncateTitle(title, 50);
          thumb.setAttribute("data-video-title", title);
          thumb.setAttribute("aria-label", "Play " + title);
          thumbImage.alt = title + " thumbnail";
        })
        .catch(function () {
          // Keep fallback caption when title lookup fails.
        });
    });

    if (!renderedAny) {
      var fallbackMessage = document.createElement("p");
      fallbackMessage.textContent = "No playable sample videos are configured yet.";
      fallbackMessage.className = "section-copy";
      videoTrack.appendChild(fallbackMessage);
    }
  }

  function parseVideoUrlsFromText(rawText) {
    return rawText
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line.length > 0;
      });
  }

  var MAX_PERFORMANCE_SAMPLES = 5;

  function pickRandomVideoUrls(urls, limit) {
    if (!urls || !urls.length) return [];
    if (urls.length <= limit) return urls.slice();
    var copy = urls.slice();
    for (var i = 0; i < limit; i++) {
      var j = i + Math.floor(Math.random() * (copy.length - i));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, limit);
  }

  function chooseVideoUrls(urls) {
    if (videoTrack && videoTrack.hasAttribute("data-video-all")) return urls.slice();
    return pickRandomVideoUrls(urls, MAX_PERFORMANCE_SAMPLES);
  }

  function loadVideoUrls() {
    if (!videoTrack) return;
    fetch("videos.txt", { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Could not load videos.txt");
        }
        return response.text();
      })
      .then(function (text) {
        var parsedUrls = parseVideoUrlsFromText(text);
        renderVideoThumbnails(chooseVideoUrls(parsedUrls.length ? parsedUrls : defaultVideoUrls));
        updateCarouselButtons();
      })
      .catch(function () {
        renderVideoThumbnails(chooseVideoUrls(defaultVideoUrls));
        updateCarouselButtons();
      });
  }

  loadVideoUrls();

  function updateCarouselButtons() {
    if (!videoTrack || !carouselPrev || !carouselNext) return;
    var maxScrollLeft = videoTrack.scrollWidth - videoTrack.clientWidth - 2;
    carouselPrev.disabled = videoTrack.scrollLeft <= 2;
    carouselNext.disabled = videoTrack.scrollLeft >= maxScrollLeft;
  }

  if (videoTrack && carouselPrev && carouselNext) {
    var scrollAmount = 310;
    carouselPrev.addEventListener("click", function () {
      trackEvent("carousel_nav_click", {
        direction: "previous",
        component: "performance_samples"
      });
      videoTrack.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    carouselNext.addEventListener("click", function () {
      trackEvent("carousel_nav_click", {
        direction: "next",
        component: "performance_samples"
      });
      videoTrack.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
    videoTrack.addEventListener("scroll", updateCarouselButtons);
    window.addEventListener("resize", updateCarouselButtons);
    updateCarouselButtons();
  }

  function initAboutGallery() {
    if (!aboutGalleryImage || !aboutGalleryPrev || !aboutGalleryNext || !aboutGalleryItems.length) return;
    var currentIndex = aboutGalleryItems
      .map(function (item) {
        return item.src;
      })
      .indexOf(aboutGalleryImage.getAttribute("src"));
    if (currentIndex < 0) currentIndex = 0;

    function showImage(nextIndex) {
      currentIndex = (nextIndex + aboutGalleryItems.length) % aboutGalleryItems.length;
      var nextItem = aboutGalleryItems[currentIndex];
      aboutGalleryImage.setAttribute("src", nextItem.src);
      aboutGalleryImage.setAttribute("alt", nextItem.caption);
      if (aboutGalleryCaption) {
        aboutGalleryCaption.textContent = nextItem.caption;
      }
      trackEvent("about_gallery_navigate", {
        image_index: currentIndex + 1,
        image_src: nextItem.src,
        image_caption: nextItem.caption
      });
    }

    showImage(currentIndex);

    aboutGalleryPrev.addEventListener("click", function () {
      showImage(currentIndex - 1);
    });

    aboutGalleryNext.addEventListener("click", function () {
      showImage(currentIndex + 1);
    });
  }

  initAboutGallery();

  document.querySelectorAll("[data-video-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      openVideoLightbox(button.getAttribute("data-video-id"), button.getAttribute("data-video-title"));
    });
  });

  if (videoFallbackLink) {
    videoFallbackLink.addEventListener("click", function () {
      trackEvent("video_fallback_click", {
        destination: videoFallbackLink.href
      });
    });
  }

  var VISIBLE_UPCOMING_SHOWS = 3;

  function collapseLaterShows() {
    var moreButton = document.querySelector("[data-schedule-more]");
    var upcoming = Array.prototype.filter.call(
      document.querySelectorAll(".show-item[data-show-end]"),
      function (item) {
        return !item.classList.contains("is-past");
      }
    );
    if (!moreButton || upcoming.length <= VISIBLE_UPCOMING_SHOWS) return;

    upcoming.slice(VISIBLE_UPCOMING_SHOWS).forEach(function (item) {
      item.classList.add("is-collapsed");
    });
    moreButton.hidden = false;
    moreButton.addEventListener("click", function () {
      upcoming.forEach(function (item) {
        item.classList.remove("is-collapsed");
      });
      moreButton.hidden = true;
      trackEvent("schedule_show_all_click", { hidden_count: upcoming.length - VISIBLE_UPCOMING_SHOWS });
    });
  }

  function initNavMenu() {
    var nav = document.querySelector(".site-nav");
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("site-nav-links");
    if (!nav || !toggle || !links) return;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target)) return;
      setOpen(false);
    });

    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 981px)").matches) setOpen(false);
    });
  }

  enhanceScheduleCards();
  hidePastShows();
  collapseLaterShows();
  initEventModals();
  initNavMenu();

  trackSectionViews();
  trackLinkClicks();
  trackSocialClicks();
  trackCtaClicks();
  window.addEventListener("scroll", trackScrollDepth, { passive: true });
  trackScrollDepth();
})();
