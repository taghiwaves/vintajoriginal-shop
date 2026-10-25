# Vintajoriginal Sitemap (Azerbaijani)

All customer-facing pages must be in Azerbaijani (AZN currency, lang="az").

## Ana Səhifə — Home Page
- `/` - Ana səhifə

## Məhsullar — Products
- `/mehsullar` - Bütün məhsullar (with category filtering, search, sorting)
- `/mehsullar/kateqoriya/:id` - Kateqoriya üzrə məhsullar
- `/mehsullar/axtaris/:query` - Axtarış nəticələri

## Məhsul haqqında — Product Detail
- `/mehsul/:id` - Məhsul təfsiəlatı

## Səbət — Cart
- `/sebet` - Səbət

## Sifarişin rəsmiləşdirilməsi — Checkout
- `/checkout` - Sifarişin təstiqlənməsi
- `/checkout/qeydiyyat` - Qeydiyyatlı oyutu ilə checkout
- `/checkout/qeydiyyatsiz` - Qeydiyyatsız oyutu ilə checkout

## Hesabım — Account
- `/hesabim` - Hesabım (dashboard)
- `/hesabim/profil` - Profilim
- `/hesabim/sifarisler` - Sifarişlərim (order history)
- `/hesabim/sifaris/:id` - Sifariş detalları
- `/hesabim/adrederim` - Adreslərim
- `/hesabim/qaytarimalar` - Qaytarılma müraciətləri
- `/hesabim/qeydiyyat` - Qeydiyyat
- `/hesabim/hesab-qaytalma` - Şifrəni שחזור
- `/hesabim/cixis` - Çıxış

## Qaytarılma və pulun geri qaytarılması — Returns & Refunds
- `/qaytarima-yeni` - Yeni qaytarılma müraciəti
- `/qaytarima/:id` - Qaytarılma müraciətinin detalları

## Static Informational Pages
- `/haqqimizda` - Haqqımızda
- `/əlaqə` - Əlaqə
- `/faq` - Sıkça sorulan suallar
- `/satici-mesafeli-shertler` - Satıcı-mesafeli satış şərtləri
- `/qaytarima-ve-geri-qaytarima-siyasiəti` - Qaytarılma və pulun geri qaytarımları siyasəti
- `/satici-yolculuq-ve-teslimat` - Satıcı yönləyişi və təlimatı
- `/gizlilik-siyasiəti` - Gizlilik siyasəti
- `/cerezi-politikasi` - Cerezi politikası
- `/satici-yollari` - Satıcı yolları (shipping information)

## Admin Panel (Protected)
- `/panel` - Admin paneli (dashboard)
- `/panel/mehsullar` - Məhsullar əmsalı
- `/panel/mehsul-elave` - Yeni məhsul əlavə et
- `/panel/mehsul-redakte/:id` - Məhsul redaktə et
- `/panel/kateqoriyalar` - Kateqoriyalar
- `/panel/sifarisler` - Sifarişlər
- `/panel/sifaris/:id` - Sifariş detalları
- `/panel/qaytarimalar` - Qaytarılma müraciətləri
- `/panel/qaytarima/:id` - Qaytarılma müraciətinin detalları
- `/panel/raportlar` - Raporlar
- `/panel/ayarlari` - Sistem ayarları

## Notes:
- All page titles, navigation labels, buttons, form fields, validation messages, and UI text must be in natural Azerbaijani.
- Use consistent terminology: e.g., "Qaytarılma" for return, "Ödəniş" for payment, "Sifariş" for order, "Səbət" for cart.
- Ensure complete loading, empty, success, and error states for all interactive pages (cart, checkout, account, admin).
- The entire production interface must be in Azerbaijani, not merely the main navigation.
- For refund requests: "/qaytarima-yeni" is for creating a new request; "/qaytarima/:id" is for viewing/updating a specific request.
- Legal and policy pages are clearly marked and should contain verified content before launch.