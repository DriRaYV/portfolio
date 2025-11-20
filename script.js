document.querySelectorAll('.nav a, .btn').forEach(function(el){
  el.addEventListener('click', function(e){
    var href = el.getAttribute('href');
    if(href && href.startsWith('#')){
      e.preventDefault();
      document.querySelector(href).scrollIntoView({behavior:'smooth', block:'start'});
    }
  });
});
