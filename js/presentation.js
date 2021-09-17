"use strict";

// DOM Elements
var playButton = document.querySelector('[data-button-presentation]');
var canvas = document.querySelector('[data-pdf]');
var mainContainer = document.querySelector('[data-main]');
var toc = document.querySelector('[data-toc]');
var tocClose = document.querySelector('[data-toc-close]');
var tocLinks = document.querySelectorAll('a[href*="#presentation"]');
var menuToc = document.querySelector('[data-menu=toc]');
var menuInfo = document.querySelector('[data-menu=info]');

// PDF.js init
var pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdf.worker.min.js';
var pdfDoc = null;
var pdfCache = [];

// PDF settings
var pageRendering = false;
var pageNumPending = null;
var pageNum = 1;
var firstAdditionalSlide = 15;
var isLightboxOpen = false;
var pdfFile = canvas.dataset.pdf;
var resizeTimeout = false;
var isPresentationEnabled = false;
var ctx = canvas.getContext('2d');

pdfjsLib.getDocument(pdfFile).promise.then(function (pdfDoc_) {
  pdfDoc = pdfDoc_;

  window.addEventListener('resize', function () {
    if (isPresentationEnabled) {
      pdfCache = [];
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        queueRenderPage(pageNum);
      }, 150);
    }
  });
  canvas.addEventListener('click', function () {
    onNextPage();
  }); 
  document.addEventListener('keydown', function (e) {
    if (isPresentationEnabled && !isLightboxOpen) {
      switch (e.keyCode) {
        case 37:
          e.preventDefault();
          onPrevPage();
          break;

        case 39:
          e.preventDefault();
          onNextPage();
          break;
      }
    }
  });
});

document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
document.addEventListener('mozfullscreenchange', fullscreenChange, false);
document.addEventListener('fullscreenchange', fullscreenChange, false);
document.addEventListener('MSFullscreenChange', fullscreenChange, false);

playButton.addEventListener('click', function () {
  openSlide(pageNum);
});

menuToc.addEventListener('click', function () {
  toc.classList.add('toc_show');
  mainContainer.classList.add('lightbox-open');
  isLightboxOpen = true;
});

menuInfo.addEventListener('click', function() {
  var isInfoActive = menuInfo.classList.contains('active');
  var pageDelta = firstAdditionalSlide - 1;

  if (!isInfoActive) {
    pageNum = pageNum + pageDelta <= pdfDoc.numPages ?
              pageNum + pageDelta :
              firstAdditionalSlide;
    menuInfo.classList.add('active');
  } else {
    pageNum = pageNum - pageDelta >= 0 ?
              pageNum - pageDelta :
              1;
    menuInfo.classList.remove('active');
  }

  queueRenderPage(pageNum);
})

tocLinks.forEach(function(tocLink) {
  tocLink.addEventListener('click', function(e) {
    e.preventDefault();
    pageNum = Number(tocLink.getAttribute('href').match(/\d+/)[0]);
    fullscreen();
    closeToc();
    menuInfo.classList.remove('active');
    isLightboxOpen = false;
    isPresentationEnabled = true;
    queueRenderPage(pageNum);
  })
});

tocClose.addEventListener('click', function () {
  closeToc();
});

function openSlide(pageNum) {
  var isFullscreenWorking = document.webkitFullscreenElement !== undefined ||
                            document.mozFullScreenElement !== undefined ||
                            document.fullscreenElement !== undefined ||
                            document.msFullscreenElement !== undefined ||
                            false;
  if (isFullscreenWorking) {
    fullscreen();
  } else {
    document.body.classList.add('fullscreen');
    queueRenderPage(pageNum);
    isPresentationEnabled = true;
  }
}

function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then(function (page) {
    canvas.classList.add('render');

    setTimeout(function () {
      var image = new Image();
  
      image.onload = function () {
        ctx.drawImage(image, 0, 0);
      };
      
      var viewport = getSize(page);
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (!isPageInCache(num)) {
        var renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        var renderTask = page.render(renderContext);
        renderTask.promise.then(function () {
          pageRendering = false;

          if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
          }

          pdfCache.push({
            num: num,
            img: canvas.toDataURL()
          });

          setTimeout(function () {
            canvas.classList.remove('render');
          }, 75);
        });
      } else {
        var currentPage = pdfCache.find(function (item) {
          return item.num === num;
        });

        pageRendering = false;
        image.src = currentPage.img;

        setTimeout(function () {
          canvas.classList.remove('render');
        }, 75);
      }
    }, 150);
  });
}

function isPageInCache(pageNum) {
  var pageNumbers = pdfCache.map(function (item) {
    return item.num;
  });
  return pageNumbers.includes(pageNum);
}

function getSize(page) {
  var desiredHeight = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight, 
    document.body.offsetHeight, document.documentElement.offsetHeight, 
    document.body.clientHeight, document.documentElement.clientHeight
  );

  var desiredWidth = Math.max(
    document.body.scrollWidth, document.documentElement.scrollWidth,
    document.body.offsetWidth, document.documentElement.offsetWidth,
    document.body.clientWidth, document.documentElement.clientWidth
  );
  
  var viewport = page.getViewport({
    scale: 1
  });

  var scale = Math.min(
    desiredHeight / viewport.height,
    desiredWidth / viewport.width
  );

  viewport = page.getViewport({
    scale: ((window.devicePixelRatio && scale) * window.devicePixelRatio) || scale
  });

  return viewport;
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

function onPrevPage() {
  if (pageNum >= firstAdditionalSlide) {
    return;
  }
  
  if (pageNum <= 1) {
    return;
  }

  pageNum--;
  queueRenderPage(pageNum);
}

function onNextPage() {
  if (pageNum >= firstAdditionalSlide - 1) {
    return;
  }

  if (pageNum >= pdfDoc.numPages) {
    return;
  }

  pageNum++;
  queueRenderPage(pageNum);
}

function fullscreen() {
  if (document.body.requestFullscreen) {
    document.body.requestFullscreen();
  } else if (document.body.mozRequestFullScreen) {
    /* Firefox */
    document.body.mozRequestFullScreen();
  } else if (document.body.webkitRequestFullscreen) {
    /* Chrome, Safari and Opera */
    document.body.webkitRequestFullscreen();
  } else if (document.body.msRequestFullscreen) {
    /* IE/Edge */
    document.body.msRequestFullscreen();
  }
}

function fullscreenChange() {
  var isFullscreenEnabled = (
    (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
    (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
    (document.fullscreenElement && document.fullscreenElement !== null) ||
    (document.msFullscreenElement && document.msFullscreenElement !== null)
  );

  if (isFullscreenEnabled) {
    pdfCache = [];
    document.body.classList.add('fullscreen');

    setTimeout(function() {
      isPresentationEnabled = true;
      queueRenderPage(pageNum);
    }, 100);
  } else {
    document.body.classList.remove('fullscreen');
    menuInfo.classList.remove('active');
    isPresentationEnabled = false;
  }
}

function closeToc() {
  toc.classList.remove('toc_show');
  mainContainer.classList.remove('lightbox-open');
  isLightboxOpen = false;
}
