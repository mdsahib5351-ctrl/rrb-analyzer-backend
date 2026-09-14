# TECH SOURCE PAN SERVICE V3

Light-theme production-oriented PAN service rebuild.

## V3 changes
- Desktop 3-column form grid; mobile 1-column.
- Red star only for required fields; optional names have no star.
- Last name required; minor guardian validation is conditional.
- Documents accept JPG/JPEG/PNG/WEBP only.
- Crop/Skip Crop immediately uploads that document with an inline card loader.
- Final Submit remains disabled until visible required documents are uploaded.
- Submit opens a demo PAN preview; Edit or Submit Application.
- Actual Firestore submission and PDF receipt happen only after final confirmation.
- Customer payment remains amount-locked in the generated link and QR.
- ACK copy fallback added.
- Admin status + reusable remark workflow added.
- User profile logout retained.

Firebase and Cloudinary values are preserved from the supplied project. Review Firestore rules before production use.
